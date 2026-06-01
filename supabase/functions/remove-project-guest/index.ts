// Supabase Edge Function: remove-project-guest
// Fully removes a person from a project's rooms — including their guest calendar
// token, so the 15-min guest-sync cron can't rebuild their shared availability.
// Service-role (bypasses RLS) but verifies the caller OWNS the rooms first.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...cors } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const { name, roomIds } = await req.json();
    if (!name || !Array.isArray(roomIds) || roomIds.length === 0) {
      return json({ error: "name and roomIds are required" }, 400);
    }

    // Who is calling?
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Only let the owner of these rooms purge guests from them.
    const { data: ownRooms } = await admin
      .from("rooms")
      .select("id, productions!inner(owner_id)")
      .in("id", roomIds)
      .eq("productions.owner_id", user.id);
    const ownedIds = (ownRooms || []).map((r: { id: string }) => r.id);
    if (ownedIds.length === 0) return json({ error: "no owned rooms" }, 403);

    // Delete the calendar token FIRST so the guest-sync cron stops re-syncing them,
    // then everything that sources the roster.
    await admin.from("guest_calendar_tokens").delete().eq("guest_name", name).in("room_id", ownedIds);
    await admin.from("guest_calendar_sync_state").delete().eq("guest_name", name).in("room_id", ownedIds);
    await admin.from("shared_availability").delete().eq("guest_name", name).in("room_id", ownedIds);
    await admin.from("date_requests").delete().eq("requester_name", name).in("room_id", ownedIds);
    await admin.from("room_members").delete().eq("name", name).in("room_id", ownedIds);

    return json({ ok: true, rooms: ownedIds.length });
  } catch (e) {
    console.error("remove-project-guest error:", e);
    return json({ error: String(e) }, 500);
  }
});
