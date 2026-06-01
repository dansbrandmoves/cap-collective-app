import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Server-owned guest calendar sync — the guest counterpart to sync-calendar.
// Triggers:
//   - on-demand: POST { roomId, guestName }  (no auth; identity is the body)
//   - cron: header x-cron-secret == app_config.cron_secret, body { all:true }
//   - service role: Authorization Bearer <service_role>, body { all:true }
// For each guest token: refresh access token, fetch primary-calendar events for a
// rolling window, derive free days IN THE GUEST'S TIMEZONE, and rewrite their
// shared_availability rows. Realtime delivers the change to the owner's view.

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CAL_API = "https://www.googleapis.com/calendar/v3";
const HORIZON_DAYS = 60;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function diag(admin: any, event: string, detail: unknown) {
  try { await admin.from("diagnostics").insert({ event, detail }); } catch { /* never throw from logging */ }
}

// Refresh a guest's access token from their stored refresh token.
async function getGuestToken(admin: any, row: any): Promise<string | null> {
  if (row.google_access_token && row.google_token_expires_at > Date.now() + 300000) {
    return row.google_access_token;
  }
  if (!row.google_refresh_token) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: row.google_refresh_token,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const tok = await res.json();
  if (tok.error) {
    if (tok.error === "invalid_grant") {
      // Refresh token permanently dead — wipe so we stop trying.
      await admin.from("guest_calendar_tokens").update({ google_refresh_token: null, google_access_token: null, google_token_expires_at: null })
        .eq("room_id", row.room_id).eq("guest_name", row.guest_name);
    }
    return null;
  }
  const expiresAt = Date.now() + tok.expires_in * 1000;
  await admin.from("guest_calendar_tokens").update({ google_access_token: tok.access_token, google_token_expires_at: expiresAt })
    .eq("room_id", row.room_id).eq("guest_name", row.guest_name);
  return tok.access_token;
}

async function fetchEvents(token: string, timeMin: string, timeMax: string) {
  const items: any[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 20; i++) {
    const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${CAL_API}/calendars/primary/events?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`events.list ${res.status}`);
    const body = await res.json();
    for (const it of body.items || []) if (it.status !== "cancelled") items.push(it);
    if (body.nextPageToken) { pageToken = body.nextPageToken; continue; }
    break;
  }
  return items;
}

// The local calendar date (YYYY-MM-DD) of an instant, in a given IANA timezone.
function localDateStr(d: Date, tz: string): string {
  // en-CA gives YYYY-MM-DD; timeZone shifts to the guest's local day.
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Derive the set of free day-strings in the next HORIZON_DAYS, in the guest's tz.
// A day is BUSY if any timed/all-day event covers any part of it; otherwise FREE.
// (Mirrors the client's "a day is free if some slot has no overlapping event",
// simplified to whole-day granularity which is what guests share.)
function deriveFreeDays(events: any[], tz: string): string[] {
  // Collect busy local-date strings.
  const busy = new Set<string>();
  for (const e of events) {
    if (e.start?.date) {
      // All-day event: [start.date, end.date) exclusive end.
      const start = new Date(e.start.date + "T00:00:00Z");
      const end = new Date((e.end?.date || e.start.date) + "T00:00:00Z");
      for (let t = start.getTime(); t < end.getTime(); t += 86400000) {
        busy.add(localDateStr(new Date(t), tz));
      }
    } else if (e.start?.dateTime) {
      // Timed event: mark each local day it touches.
      const start = new Date(e.start.dateTime);
      const end = new Date(e.end?.dateTime || e.start.dateTime);
      const startDay = localDateStr(start, tz);
      const endDay = localDateStr(end, tz);
      busy.add(startDay);
      if (endDay !== startDay) {
        // Walk day by day across the span.
        let cur = new Date(start);
        for (let i = 0; i < 366; i++) {
          const ds = localDateStr(cur, tz);
          busy.add(ds);
          if (ds === endDay) break;
          cur = new Date(cur.getTime() + 86400000);
        }
      }
    }
  }
  // Free = today..+HORIZON not in busy.
  const free: string[] = [];
  const now = new Date();
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const ds = localDateStr(new Date(now.getTime() + i * 86400000), tz);
    if (!busy.has(ds)) free.push(ds);
  }
  return free;
}

async function syncGuest(admin: any, row: any) {
  const tz = row.timezone || "UTC";
  const token = await getGuestToken(admin, row);
  if (!token) {
    await diag(admin, "guest_sync", { actor: row.guest_name, roomId: row.room_id, status: "skip", summary: "No valid token — guest must reconnect" });
    return { roomId: row.room_id, guestName: row.guest_name, skipped: "no token" };
  }
  const timeMin = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const timeMax = new Date(Date.now() + (HORIZON_DAYS + 1) * 24 * 3600 * 1000).toISOString();
  let events: any[];
  try {
    events = await fetchEvents(token, timeMin, timeMax);
  } catch (e) {
    await diag(admin, "guest_sync", { actor: row.guest_name, roomId: row.room_id, status: "error", summary: "events.list failed", error: String((e as Error).message) });
    return { roomId: row.room_id, guestName: row.guest_name, error: String((e as Error).message) };
  }
  const free = deriveFreeDays(events, tz);
  const rows = free.map((date) => ({ room_id: row.room_id, guest_name: row.guest_name, date, is_available: true }));

  // Rewrite this guest's availability: delete then insert.
  const { error: delErr } = await admin.from("shared_availability").delete().eq("room_id", row.room_id).eq("guest_name", row.guest_name);
  let insErr: string | undefined;
  if (rows.length) {
    const { error } = await admin.from("shared_availability").insert(rows);
    if (error) insErr = error.message;
  }
  const failed = !!(delErr || insErr);
  await diag(admin, "guest_sync", {
    actor: row.guest_name, roomId: row.room_id, status: failed ? "error" : "ok",
    summary: failed ? "Sync write failed" : `Synced ${rows.length} free days`,
    steps: [
      { label: "fetched events", status: "ok", eventCount: events.length },
      { label: "derived free days", status: "ok", freeDays: rows.length, tz },
      { label: "rewrote availability", status: failed ? "error" : "ok", error: delErr?.message || insErr || null },
    ],
  });
  await admin.from("guest_calendar_sync_state").upsert(
    { room_id: row.room_id, guest_name: row.guest_name, google_calendar_id: "primary", baseline_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { onConflict: "room_id,guest_name,google_calendar_id" });
  return { roomId: row.room_id, guestName: row.guest_name, freeDays: rows.length };
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

    let rows: any[] = [];
    if (body.all && (isService || cronOk)) {
      const { data } = await admin.from("guest_calendar_tokens").select("*").not("google_refresh_token", "is", null);
      rows = data || [];
    } else if (body.roomId && body.guestName) {
      const { data } = await admin.from("guest_calendar_tokens").select("*").eq("room_id", body.roomId).eq("guest_name", body.guestName).limit(1);
      rows = data || [];
    } else {
      return json({ error: "Provide {roomId,guestName} or authorized {all:true}" }, 400);
    }

    const results = [];
    for (const row of rows) {
      try { results.push(await syncGuest(admin, row)); }
      catch (e) { results.push({ roomId: row.room_id, guestName: row.guest_name, error: String((e as Error).message) }); }
    }
    return json({ ok: true, count: results.length, results });
  } catch (err) {
    console.error("sync-guest-calendars error:", err);
    return json({ error: String((err as Error).message) }, 500);
  }
});
