import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Microsoft Graph calendar OAuth — owner connect. Mirrors google-calendar-auth:
// exchange an auth code for a refresh token (stored on profiles.ms_*), refresh
// access tokens, and disconnect. The actual event sync lives in sync-ms-calendar.
const MS_CLIENT_ID = Deno.env.get("MS_CLIENT_ID")!;
const MS_CLIENT_SECRET = Deno.env.get("MS_CLIENT_SECRET")!;
// Multi-tenant + personal accounts → the token endpoint must be "common"
// (a specific tenant GUID would reject personal Microsoft accounts).
const MS_TENANT = Deno.env.get("MS_TENANT_ID") || "common";
const TOKEN_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
// offline_access → refresh token; Calendars.Read → events; User.Read → profile.
const SCOPE = "offline_access Calendars.Read User.Read openid email profile";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || SUPABASE_SERVICE_ROLE_KEY;

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
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  return user;
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: MS_CLIENT_ID, client_secret: MS_CLIENT_SECRET, scope: SCOPE, ...params }),
  });
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action } = body;

    if (action === "exchange") {
      const userId = (await getUser(req))?.id || body.userId;
      if (!userId) return jsonRes({ error: "No user ID" }, 401);
      const { code, redirectUri } = body;
      if (!code || !redirectUri) return jsonRes({ error: "Missing code or redirectUri" }, 400);

      let tokens: any;
      try {
        tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
      } catch (e) {
        console.error("Network error reaching Microsoft (exchange):", e);
        return jsonRes({ error: "Network error reaching Microsoft. Please try again.", transient: true }, 503);
      }
      if (tokens.error) {
        console.error("MS token exchange error:", tokens);
        return jsonRes({ error: tokens.error_description || tokens.error }, 400);
      }
      if (!tokens.refresh_token) {
        return jsonRes({ error: "Microsoft didn't return a refresh token. Try reconnecting.", noRefreshToken: true }, 400);
      }
      const expiresAt = Date.now() + ((tokens.expires_in || 3600) * 1000);
      await supabase.from("profiles").update({
        ms_access_token: tokens.access_token,
        ms_refresh_token: tokens.refresh_token,
        ms_token_expires_at: expiresAt,
      }).eq("id", userId);
      return jsonRes({ access_token: tokens.access_token, expires_at: expiresAt });
    }

    if (action === "refresh") {
      const user = await getUser(req);
      if (!user) return jsonRes({ error: "Not authenticated" }, 401);
      const { data: profile } = await supabase.from("profiles").select("ms_refresh_token").eq("id", user.id).single();
      if (!profile?.ms_refresh_token) return jsonRes({ error: "No refresh token. Reconnect Microsoft Calendar." }, 400);

      let tokens: any;
      try {
        tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: profile.ms_refresh_token });
      } catch (e) {
        console.warn("Network error refreshing MS token:", e);
        return jsonRes({ error: "Network error. Please try again shortly.", transient: true }, 503);
      }
      if (tokens.error) {
        const dead = tokens.error === "invalid_grant";
        if (dead) {
          await supabase.from("profiles").update({ ms_access_token: null, ms_refresh_token: null, ms_token_expires_at: null }).eq("id", user.id);
          return jsonRes({ error: "Your Microsoft Calendar connection has been revoked. Please reconnect.", permanentlyDead: true }, 401);
        }
        return jsonRes({ error: tokens.error_description || tokens.error, transient: true }, 502);
      }
      const expiresAt = Date.now() + ((tokens.expires_in || 3600) * 1000);
      const update: Record<string, unknown> = { ms_access_token: tokens.access_token, ms_token_expires_at: expiresAt };
      // MS may rotate the refresh token; persist the new one if returned.
      if (tokens.refresh_token) update.ms_refresh_token = tokens.refresh_token;
      await supabase.from("profiles").update(update).eq("id", user.id);
      return jsonRes({ access_token: tokens.access_token, expires_at: expiresAt });
    }

    if (action === "disconnect") {
      const user = await getUser(req);
      if (!user) return jsonRes({ error: "Not authenticated" }, 401);
      await supabase.from("profiles").update({ ms_access_token: null, ms_refresh_token: null, ms_token_expires_at: null }).eq("id", user.id);
      return jsonRes({ success: true });
    }

    return jsonRes({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("microsoft-calendar-auth error:", err);
    return jsonRes({ error: (err as Error).message }, 500);
  }
});
