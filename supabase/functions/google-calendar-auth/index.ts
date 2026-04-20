import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  return user;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action } = body;

    if (action === "exchange") {
      const userId = (await getUser(req))?.id || body.userId;
      if (!userId) return jsonRes({ error: "No user ID" }, 401);

      const { code, redirectUri } = body;
      if (!code || !redirectUri) return jsonRes({ error: "Missing code or redirectUri" }, 400);

      let tokenRes: Response;
      try {
        tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });
      } catch (fetchErr) {
        console.error("Network error reaching Google (exchange):", fetchErr);
        return jsonRes({ error: "Network error reaching Google. Please try again.", transient: true }, 503);
      }

      const tokens = await tokenRes.json();
      if (tokens.error) {
        console.error("Google token exchange error:", tokens);
        return jsonRes({ error: tokens.error_description || tokens.error }, 400);
      }

      // Google only returns refresh_token on first consent (or when prompt=consent forces it).
      // If it's missing, silent storage of null will work for ~1 hour then break with no
      // recovery path — fail loudly here so the user can resolve it immediately.
      if (!tokens.refresh_token) {
        console.error("Exchange returned no refresh_token for user:", userId);
        return jsonRes({
          error: "Google didn't return a refresh token. Revoke Coordie at myaccount.google.com/permissions and reconnect, or try an incognito window.",
          noRefreshToken: true,
        }, 400);
      }

      const expiresAt = Date.now() + (tokens.expires_in * 1000);
      await supabase.from("profiles").update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expires_at: expiresAt,
      }).eq("id", userId);

      return jsonRes({ access_token: tokens.access_token, expires_at: expiresAt });
    }

    if (action === "refresh") {
      const user = await getUser(req);
      if (!user) return jsonRes({ error: "Not authenticated" }, 401);

      const { data: profile } = await supabase
        .from("profiles")
        .select("google_refresh_token")
        .eq("id", user.id)
        .single();
      if (!profile?.google_refresh_token) {
        return jsonRes({ error: "No refresh token. Reconnect Google Calendar." }, 400);
      }

      let tokenRes: Response;
      try {
        tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            refresh_token: profile.google_refresh_token,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            grant_type: "refresh_token",
          }),
        });
      } catch (fetchErr) {
        // Network error — transient. Keep the refresh token so next call can retry.
        console.warn("Network error refreshing Google token (keeping refresh token for retry):", fetchErr);
        return jsonRes({ error: "Network error. Please try again shortly.", transient: true }, 503);
      }

      const tokens = await tokenRes.json();

      if (tokens.error) {
        // invalid_grant = the refresh token is permanently dead (user revoked in Google,
        // password changed on certain account types, or 6+ months of disuse). Wipe it.
        // Everything else (invalid_client, 5xx, rate limits) is transient — keep the token
        // so we can retry next time instead of forcing a reconnect on every blip.
        const permanentlyDead = tokens.error === "invalid_grant";

        if (permanentlyDead) {
          console.warn(`Refresh token permanently dead (${tokens.error}) for user ${user.id} — wiping`);
          await supabase.from("profiles").update({
            google_access_token: null,
            google_refresh_token: null,
            google_token_expires_at: null,
          }).eq("id", user.id);
          return jsonRes({
            error: "Your Google Calendar connection has been revoked. Please reconnect.",
            permanentlyDead: true,
          }, 401);
        }

        console.warn(`Transient refresh error (${tokens.error}) for user ${user.id} — keeping refresh token`);
        return jsonRes({
          error: tokens.error_description || tokens.error,
          transient: true,
        }, 502);
      }

      const expiresAt = Date.now() + (tokens.expires_in * 1000);
      await supabase.from("profiles").update({
        google_access_token: tokens.access_token,
        google_token_expires_at: expiresAt,
      }).eq("id", user.id);
      return jsonRes({ access_token: tokens.access_token, expires_at: expiresAt });
    }

    if (action === "disconnect") {
      const user = await getUser(req);
      if (!user) return jsonRes({ error: "Not authenticated" }, 401);
      await supabase.from("profiles").update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expires_at: null,
      }).eq("id", user.id);
      return jsonRes({ success: true });
    }

    return jsonRes({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("google-calendar-auth error:", err);
    return jsonRes({ error: (err as Error).message }, 500);
  }
});
