import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Server-owned incremental Google Calendar sync. Triggers:
//  - on-demand: client invoke with user JWT  -> sync that owner
//  - cron: header x-cron-secret == app_config.cron_secret, body {all:true} -> all owners
//  - service role: Authorization Bearer <service_role>, body {all|userId}
// Writes only changed rows to owner_calendar_events (syncToken deltas + upsert/delete).

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_ROLE;
const CAL_API = "https://www.googleapis.com/calendar/v3";
const WINDOW_BACK_MS = 31 * 24 * 3600 * 1000;
const WINDOW_FWD_MS = 92 * 24 * 3600 * 1000;
const BASELINE_TTL_MS = 24 * 3600 * 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });

function mapEvent(ownerId: string, calId: string, e: any) {
  return {
    owner_id: ownerId,
    calendar_id: calId,
    google_event_id: e.id,
    title: e.summary || "",
    start: e.start?.dateTime ?? e.start?.date ?? null,
    end_at: e.end?.dateTime ?? e.end?.date ?? null,
    is_all_day: e.start ? !e.start.dateTime : false,
  };
}

// Last-wins dedupe by google_event_id — Google can return the same id twice in a
// window (recurring exceptions), which would break upsert's ON CONFLICT.
function dedupe(rows: any[]) {
  const m = new Map<string, any>();
  for (const r of rows) if (r.google_event_id) m.set(r.google_event_id, r);
  return [...m.values()];
}

async function getAccessToken(admin: any, ownerId: string): Promise<string | null> {
  const { data: p } = await admin.from("profiles")
    .select("google_refresh_token, google_access_token, google_token_expires_at")
    .eq("id", ownerId).single();
  if (!p?.google_refresh_token) return null;
  if (p.google_access_token && p.google_token_expires_at > Date.now() + 300000) return p.google_access_token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: p.google_refresh_token, client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET, grant_type: "refresh_token",
    }),
  });
  const tok = await res.json();
  if (tok.error) {
    if (tok.error === "invalid_grant") {
      await admin.from("profiles").update({ google_access_token: null, google_refresh_token: null, google_token_expires_at: null }).eq("id", ownerId);
    }
    return null;
  }
  const expiresAt = Date.now() + tok.expires_in * 1000;
  await admin.from("profiles").update({ google_access_token: tok.access_token, google_token_expires_at: expiresAt }).eq("id", ownerId);
  return tok.access_token;
}

async function listAll(calId: string, token: string, base: Record<string, string>) {
  const items: any[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  for (let i = 0; i < 20; i++) {
    const params = new URLSearchParams({ ...base, maxResults: "250" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 410) return { items, nextSyncToken: undefined, gone: true };
    const body = await res.json();
    if (!body || body.error) throw new Error(body?.error?.message || `events.list ${res.status}`);
    for (const it of body.items || []) items.push(it);
    if (body.nextPageToken) { pageToken = body.nextPageToken; continue; }
    nextSyncToken = body.nextSyncToken;
    break;
  }
  return { items, nextSyncToken, gone: false };
}

async function syncCalendar(admin: any, ownerId: string, token: string, calId: string) {
  const { data: state } = await admin.from("calendar_sync_state")
    .select("sync_token, baseline_at").eq("owner_id", ownerId).eq("google_calendar_id", calId).maybeSingle();
  const baselineStale = !state?.baseline_at || (Date.now() - new Date(state.baseline_at).getTime() > BASELINE_TTL_MS);
  const doBaseline = !state?.sync_token || baselineStale;

  if (doBaseline) {
    const timeMin = new Date(Date.now() - WINDOW_BACK_MS).toISOString();
    const timeMax = new Date(Date.now() + WINDOW_FWD_MS).toISOString();
    const { items, nextSyncToken } = await listAll(calId, token, { timeMin, timeMax, singleEvents: "true" });
    const rows = dedupe(items.filter((e) => e.status !== "cancelled").map((e) => mapEvent(ownerId, calId, e)));
    await admin.from("owner_calendar_events").delete().eq("owner_id", ownerId).eq("calendar_id", calId);
    let upErr: string | undefined;
    if (rows.length) {
      const { error } = await admin.from("owner_calendar_events").upsert(rows, { onConflict: "owner_id,calendar_id,google_event_id" });
      if (error) upErr = error.message;
    }
    await admin.from("calendar_sync_state").upsert({
      owner_id: ownerId, google_calendar_id: calId,
      sync_token: upErr ? null : (nextSyncToken ?? null),
      baseline_at: upErr ? null : new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    if (upErr) console.error("baseline upsert error", calId, upErr);
    return { calId, mode: "baseline", count: rows.length, error: upErr };
  }

  const { items, nextSyncToken, gone } = await listAll(calId, token, { syncToken: state.sync_token, singleEvents: "true" });
  if (gone) {
    await admin.from("calendar_sync_state").upsert({ owner_id: ownerId, google_calendar_id: calId, sync_token: null, baseline_at: null, updated_at: new Date().toISOString() });
    return { calId, mode: "gone-reset", count: 0 };
  }
  if (items.length === 0) {
    if (nextSyncToken && nextSyncToken !== state.sync_token) {
      await admin.from("calendar_sync_state").update({ sync_token: nextSyncToken, updated_at: new Date().toISOString() }).eq("owner_id", ownerId).eq("google_calendar_id", calId);
    }
    return { calId, mode: "incremental", changed: 0 };
  }
  const cancelled = items.filter((e) => e.status === "cancelled").map((e) => e.id);
  const upserts = dedupe(items.filter((e) => e.status !== "cancelled").map((e) => mapEvent(ownerId, calId, e)));
  if (cancelled.length) {
    await admin.from("owner_calendar_events").delete().eq("owner_id", ownerId).eq("calendar_id", calId).in("google_event_id", cancelled);
  }
  let upErr: string | undefined;
  if (upserts.length) {
    const { error } = await admin.from("owner_calendar_events").upsert(upserts, { onConflict: "owner_id,calendar_id,google_event_id" });
    if (error) upErr = error.message;
  }
  if (!upErr) {
    await admin.from("calendar_sync_state").update({ sync_token: nextSyncToken ?? state.sync_token, updated_at: new Date().toISOString() }).eq("owner_id", ownerId).eq("google_calendar_id", calId);
  } else { console.error("incremental upsert error", calId, upErr); }
  return { calId, mode: "incremental", changed: items.length, removed: cancelled.length, error: upErr };
}

async function syncOwner(admin: any, ownerId: string) {
  const { data: p } = await admin.from("profiles").select("connected_calendars").eq("id", ownerId).single();
  const governing = (p?.connected_calendars || []).filter((c: any) => c.role === "governs");
  if (!governing.length) return { ownerId, skipped: "no governing calendars" };
  const token = await getAccessToken(admin, ownerId);
  if (!token) return { ownerId, skipped: "no valid token" };
  const cals = [];
  for (const c of governing) {
    try { cals.push(await syncCalendar(admin, ownerId, token, c.googleCalendarId)); }
    catch (e) { cals.push({ calId: c.googleCalendarId, error: String(e?.message || e) }); }
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
      const { data } = await admin.from("profiles").select("id").not("google_refresh_token", "is", null);
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
      catch (e) { results.push({ ownerId: id, error: String(e?.message || e) }); }
    }
    return json({ ok: true, count: results.length, results });
  } catch (err) {
    console.error("sync-calendar error:", err);
    return json({ error: String(err?.message || err) }, 500);
  }
});
