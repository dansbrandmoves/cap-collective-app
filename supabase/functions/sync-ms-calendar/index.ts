import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Server-owned Microsoft Graph calendar sync (owner). Mirrors sync-calendar's
// auth modes:
//   - on-demand: client invoke with user JWT  -> sync that owner
//   - cron: header x-cron-secret == app_config.cron_secret, body {all:true}
//   - service role: Authorization Bearer <service_role>, body {all|userId}
// Writes only this owner's Microsoft rows in owner_calendar_events (calendar_id is
// namespaced "ms:<id>", so it never collides with Google rows). Full-replace per
// calendar within the window (simple + correct; no incremental delta for v1).

const MS_CLIENT_ID = Deno.env.get("MS_CLIENT_ID")!;
const MS_CLIENT_SECRET = Deno.env.get("MS_CLIENT_SECRET")!;
const MS_TENANT = Deno.env.get("MS_TENANT_ID") || "common";
const TOKEN_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
const SCOPE = "offline_access Calendars.Read User.Read openid email profile";
const GRAPH = "https://graph.microsoft.com/v1.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_ROLE;
const WINDOW_BACK_MS = 31 * 24 * 3600 * 1000;
const WINDOW_FWD_MS = 92 * 24 * 3600 * 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function getMsToken(admin: any, ownerId: string): Promise<string | null> {
  const { data: p } = await admin.from("profiles")
    .select("ms_refresh_token, ms_access_token, ms_token_expires_at")
    .eq("id", ownerId).single();
  if (!p?.ms_refresh_token) return null;
  if (p.ms_access_token && p.ms_token_expires_at > Date.now() + 300000) return p.ms_access_token;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID, client_secret: MS_CLIENT_SECRET, scope: SCOPE,
      grant_type: "refresh_token", refresh_token: p.ms_refresh_token,
    }),
  });
  const tok = await res.json();
  if (tok.error || !tok.access_token) {
    if (tok.error === "invalid_grant") {
      await admin.from("profiles").update({ ms_access_token: null, ms_refresh_token: null, ms_token_expires_at: null }).eq("id", ownerId);
    }
    return null;
  }
  const expiresAt = Date.now() + ((tok.expires_in || 3600) * 1000);
  const update: Record<string, unknown> = { ms_access_token: tok.access_token, ms_token_expires_at: expiresAt };
  if (tok.refresh_token) update.ms_refresh_token = tok.refresh_token;
  await admin.from("profiles").update(update).eq("id", ownerId);
  return tok.access_token;
}

// Fetch all events in the window for one Microsoft calendar (follows @odata.nextLink).
async function fetchWindow(token: string, msCalId: string) {
  const start = new Date(Date.now() - WINDOW_BACK_MS).toISOString();
  const end = new Date(Date.now() + WINDOW_FWD_MS).toISOString();
  let url: string | undefined =
    `${GRAPH}/me/calendars/${encodeURIComponent(msCalId)}/calendarView?startDateTime=${start}&endDateTime=${end}&$top=250&$select=id,subject,start,end,isAllDay,showAs`;
  const items: any[] = [];
  for (let i = 0; i < 20 && url; i++) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(body?.error?.message || `calendarView ${res.status}`);
    for (const it of body.value || []) items.push(it);
    url = body["@odata.nextLink"];
  }
  return items;
}

function mapEvent(ownerId: string, calId: string, e: any) {
  const allDay = !!e.isAllDay;
  const startRaw = e.start?.dateTime || "";
  const endRaw = e.end?.dateTime || "";
  // With Prefer UTC, Graph returns naive UTC datetimes — append Z for timed events.
  const start = allDay ? startRaw.slice(0, 10) : `${startRaw.replace(/\.\d+$/, "")}Z`;
  const end = allDay ? endRaw.slice(0, 10) : `${endRaw.replace(/\.\d+$/, "")}Z`;
  return {
    owner_id: ownerId,
    calendar_id: calId,            // "ms:<id>"
    google_event_id: e.id,         // reuse the id column (provider-agnostic)
    title: e.subject || "",
    start,
    end_at: end,
    is_all_day: allDay,
  };
}

async function syncOwner(admin: any, ownerId: string) {
  const { data: p } = await admin.from("profiles").select("connected_calendars").eq("id", ownerId).single();
  const governing = (p?.connected_calendars || []).filter(
    (c: any) => c.role === "governs" && (c.provider === "microsoft" || String(c.googleCalendarId || "").startsWith("ms:")),
  );
  if (!governing.length) return { ownerId, skipped: "no governing MS calendars" };
  const token = await getMsToken(admin, ownerId);
  if (!token) return { ownerId, skipped: "no valid MS token" };

  const cals = [];
  for (const c of governing) {
    const calId = c.googleCalendarId;                       // "ms:<id>" (storage key)
    const rawId = calId.startsWith("ms:") ? calId.slice(3) : calId; // Graph id
    try {
      const events = await fetchWindow(token, rawId);
      const rows = events
        .filter((e: any) => e.showAs !== "free")             // free/transparent events don't block
        .map((e: any) => mapEvent(ownerId, calId, e));
      // Full-replace this calendar's rows within the window.
      await admin.from("owner_calendar_events").delete().eq("owner_id", ownerId).eq("calendar_id", calId);
      let upErr: string | undefined;
      if (rows.length) {
        const { error } = await admin.from("owner_calendar_events").insert(rows);
        if (error) upErr = error.message;
      }
      cals.push({ calId, count: rows.length, error: upErr });
    } catch (e) {
      cals.push({ calId, error: String((e as Error)?.message || e) });
    }
  }
  return { ownerId, calendars: cals };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const authHeader = req.headers.get("Authorization") || "";
    const isService = authHeader === `Bearer ${SERVICE_ROLE}`;
    const body = await req.json().catch(() => ({}));

    let cronOk = false;
    if (body.all && !isService) {
      const provided = req.headers.get("x-cron-secret");
      if (provided) {
        const { data: cfg } = await admin.from("app_config").select("value").eq("key", "cron_secret").maybeSingle();
        cronOk = !!cfg?.value && cfg.value === provided;
      }
    }

    let ownerIds: string[] = [];
    if (body.all && (isService || cronOk)) {
      const { data } = await admin.from("profiles").select("id").not("ms_refresh_token", "is", null);
      ownerIds = (data || []).map((r: any) => r.id);
    } else if (isService && body.userId) {
      ownerIds = [body.userId];
    } else {
      const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Not authenticated" }, 401);
      ownerIds = [user.id];
    }

    const results = [];
    for (const id of ownerIds) {
      try { results.push(await syncOwner(admin, id)); }
      catch (e) { results.push({ ownerId: id, error: String((e as Error)?.message || e) }); }
    }
    return json({ ok: true, count: results.length, results });
  } catch (err) {
    console.error("sync-ms-calendar error:", err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
