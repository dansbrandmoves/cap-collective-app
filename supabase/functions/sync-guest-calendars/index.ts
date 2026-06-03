import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Server-owned guest calendar sync — the guest counterpart to sync-calendar.
// Now PROVIDER-AGNOSTIC: a guest may have connected Google, Microsoft/Outlook, or
// BOTH (stored on the same guest_calendar_tokens row). Busy time from every
// connected provider is merged — a day is free only if it's free everywhere.
// Triggers:
//   - on-demand: POST { roomId, guestName }  (no auth; identity is the body)
//   - cron: header x-cron-secret == app_config.cron_secret, body { all:true }
//   - service role: Authorization Bearer <service_role>, body { all:true }

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const MS_CLIENT_ID = Deno.env.get("MS_CLIENT_ID") || "";
const MS_CLIENT_SECRET = Deno.env.get("MS_CLIENT_SECRET") || "";
const MS_TENANT = "common"; // work + personal accounts; a tenant GUID rejects personal (AADSTS70000121)
const MS_TOKEN_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
const MS_SCOPE = "offline_access Calendars.Read User.Read openid email profile";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CAL_API = "https://www.googleapis.com/calendar/v3";
const GRAPH = "https://graph.microsoft.com/v1.0";
const HORIZON_DAYS = 60;
// A day only counts as UNAVAILABLE when it's heavily booked. A single short meeting
// shouldn't zero out someone's whole day (that made busy people contribute nothing).
const BUSY_DAY_MINUTES = 360; // ~6h of opaque meetings = "can't meet that day"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function diag(admin: any, event: string, detail: unknown) {
  try { await admin.from("diagnostics").insert({ event, detail }); } catch { /* never throw from logging */ }
}

// ── Token refresh (per provider) ──
async function getGuestGoogleToken(admin: any, row: any): Promise<string | null> {
  if (row.google_access_token && row.google_token_expires_at > Date.now() + 300000) return row.google_access_token;
  if (!row.google_refresh_token) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: row.google_refresh_token, client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET, grant_type: "refresh_token",
    }),
  });
  const tok = await res.json();
  if (tok.error) {
    if (tok.error === "invalid_grant") {
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

async function getGuestMsToken(admin: any, row: any): Promise<string | null> {
  if (!MS_CLIENT_ID) return null;
  if (row.ms_access_token && row.ms_token_expires_at > Date.now() + 300000) return row.ms_access_token;
  if (!row.ms_refresh_token) return null;
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID, client_secret: MS_CLIENT_SECRET, scope: MS_SCOPE,
      grant_type: "refresh_token", refresh_token: row.ms_refresh_token,
    }),
  });
  const tok = await res.json();
  if (tok.error || !tok.access_token) {
    if (tok.error === "invalid_grant") {
      await admin.from("guest_calendar_tokens").update({ ms_refresh_token: null, ms_access_token: null, ms_token_expires_at: null })
        .eq("room_id", row.room_id).eq("guest_name", row.guest_name);
    }
    return null;
  }
  const expiresAt = Date.now() + ((tok.expires_in || 3600) * 1000);
  const upd: Record<string, unknown> = { ms_access_token: tok.access_token, ms_token_expires_at: expiresAt };
  if (tok.refresh_token) upd.ms_refresh_token = tok.refresh_token;
  await admin.from("guest_calendar_tokens").update(upd).eq("room_id", row.room_id).eq("guest_name", row.guest_name);
  return tok.access_token;
}

// ── Event fetch (per provider) → normalized busy intervals ──
type Busy = { allDay: boolean; start: Date; end: Date };

async function fetchGoogleBusy(token: string, timeMin: string, timeMax: string): Promise<Busy[]> {
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
  const out: Busy[] = [];
  for (const e of items) {
    if (e.transparency === "transparent") continue; // "Free" events don't block
    if (e.start?.date) {
      out.push({ allDay: true, start: new Date(e.start.date + "T00:00:00Z"), end: new Date((e.end?.date || e.start.date) + "T00:00:00Z") });
    } else if (e.start?.dateTime) {
      out.push({ allDay: false, start: new Date(e.start.dateTime), end: new Date(e.end?.dateTime || e.start.dateTime) });
    }
  }
  return out;
}

async function fetchMsBusy(token: string, timeMin: string, timeMax: string): Promise<Busy[]> {
  const items: any[] = [];
  let url: string | undefined =
    `${GRAPH}/me/calendarView?startDateTime=${timeMin}&endDateTime=${timeMax}&$top=250&$select=subject,start,end,isAllDay,showAs`;
  for (let i = 0; i < 20 && url; i++) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(body?.error?.message || `calendarView ${res.status}`);
    for (const it of body.value || []) items.push(it);
    url = body["@odata.nextLink"];
  }
  const out: Busy[] = [];
  for (const e of items) {
    if (e.showAs === "free") continue; // transparent events don't block
    if (e.isAllDay) {
      const sd = (e.start?.dateTime || "").slice(0, 10);
      const ed = (e.end?.dateTime || "").slice(0, 10);
      if (sd) out.push({ allDay: true, start: new Date(sd + "T00:00:00Z"), end: new Date((ed || sd) + "T00:00:00Z") });
    } else if (e.start?.dateTime) {
      const s = `${e.start.dateTime.replace(/\.\d+$/, "")}Z`;
      const en = `${(e.end?.dateTime || e.start.dateTime).replace(/\.\d+$/, "")}Z`;
      out.push({ allDay: false, start: new Date(s), end: new Date(en) });
    }
  }
  return out;
}

// The local calendar date (YYYY-MM-DD) of an instant, in a given IANA timezone.
function localDateStr(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Merge all providers' busy intervals → the set of free day-strings (guest tz).
function deriveFreeDays(busy: Busy[], tz: string): string[] {
  const busyMinutes = new Map<string, number>();
  const fullDayBlocked = new Set<string>();
  for (const e of busy) {
    if (e.allDay) {
      for (let t = e.start.getTime(); t < e.end.getTime(); t += 86400000) fullDayBlocked.add(localDateStr(new Date(t), tz));
    } else {
      let mins = Math.max(0, (e.end.getTime() - e.start.getTime()) / 60000);
      mins = Math.min(mins, 24 * 60);
      const ds = localDateStr(e.start, tz);
      busyMinutes.set(ds, (busyMinutes.get(ds) || 0) + mins);
    }
  }
  const free: string[] = [];
  const now = new Date();
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const ds = localDateStr(new Date(now.getTime() + i * 86400000), tz);
    if (fullDayBlocked.has(ds)) continue;
    if ((busyMinutes.get(ds) || 0) >= BUSY_DAY_MINUTES) continue;
    free.push(ds);
  }
  return free;
}

async function syncGuest(admin: any, row: any) {
  const tz = row.timezone || "UTC";
  const timeMin = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const timeMax = new Date(Date.now() + (HORIZON_DAYS + 1) * 24 * 3600 * 1000).toISOString();

  const googleToken = await getGuestGoogleToken(admin, row);
  const msToken = await getGuestMsToken(admin, row);
  if (!googleToken && !msToken) {
    await diag(admin, "guest_sync", { actor: row.guest_name, roomId: row.room_id, status: "skip", summary: "No valid token — guest must reconnect" });
    return { roomId: row.room_id, guestName: row.guest_name, skipped: "no token" };
  }

  const busy: Busy[] = [];
  const steps: any[] = [];
  let hadError = false;
  if (googleToken) {
    try { const g = await fetchGoogleBusy(googleToken, timeMin, timeMax); busy.push(...g); steps.push({ label: "fetched Google events", status: "ok", count: g.length }); }
    catch (e) { hadError = true; steps.push({ label: "fetched Google events", status: "error", error: String((e as Error).message) }); }
  }
  if (msToken) {
    try { const m = await fetchMsBusy(msToken, timeMin, timeMax); busy.push(...m); steps.push({ label: "fetched Outlook events", status: "ok", count: m.length }); }
    catch (e) { hadError = true; steps.push({ label: "fetched Outlook events", status: "error", error: String((e as Error).message) }); }
  }

  const free = deriveFreeDays(busy, tz);
  const rows = free.map((date) => ({ room_id: row.room_id, guest_name: row.guest_name, date, is_available: true }));

  // Rewrite this guest's availability: delete then insert.
  const { error: delErr } = await admin.from("shared_availability").delete().eq("room_id", row.room_id).eq("guest_name", row.guest_name);
  let insErr: string | undefined;
  if (rows.length) {
    const { error } = await admin.from("shared_availability").insert(rows);
    if (error) insErr = error.message;
  }
  const failed = hadError || !!(delErr || insErr);
  steps.push({ label: "derived free days", status: "ok", freeDays: rows.length, tz });
  steps.push({ label: "rewrote availability", status: (delErr || insErr) ? "error" : "ok", error: delErr?.message || insErr || null });
  await diag(admin, "guest_sync", {
    actor: row.guest_name, roomId: row.room_id, status: failed ? "error" : "ok",
    summary: failed ? "Guest sync had errors" : `Synced ${rows.length} free days`,
    providers: { google: !!googleToken, microsoft: !!msToken },
    steps,
  });
  return { roomId: row.room_id, guestName: row.guest_name, freeDays: rows.length, providers: { google: !!googleToken, microsoft: !!msToken } };
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
      // Any guest with at least one connected provider.
      const { data } = await admin.from("guest_calendar_tokens").select("*")
        .or("google_refresh_token.not.is.null,ms_refresh_token.not.is.null");
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
