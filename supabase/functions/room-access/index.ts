// Supabase Edge Function: room-access
// Turns a room share-token into a short-lived, project-scoped capability.
//
// A guest has no identity, only a link. This verifies the link server-side (service
// role) and mints an HS256 JWT scoped to exactly one production, so RLS (and Realtime)
// can enforce "this guest may touch only this project." The JWT keeps role="anon"
// (no privilege escalation) and carries a production_id claim the RLS helpers read.
//
// The signing secret is the project's legacy HS256 JWT secret, stored in app_config
// (service-role-only) so it never ships to the browser. Anon-invocable: guests call
// this with just the anon key (no session yet).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://esm.sh/jose@5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...cors } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string") return json({ error: "token required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve the share token → production/room (same logic as the old client-side
    // resolveToken, moved server-side so the tables no longer need anon read access).
    let productionId: string | null = null;
    let roomId: string | null = null;
    let mode = "open_link";
    let memberName: string | null = null;

    const { data: room } = await admin
      .from("rooms").select("id, production_id").eq("open_token", token).limit(1).maybeSingle();
    if (room) {
      productionId = room.production_id;
      roomId = room.id;
      mode = "open_link";
    } else {
      const { data: member } = await admin
        .from("room_members").select("id, room_id, name").eq("invite_token", token).limit(1).maybeSingle();
      if (member) {
        const { data: r } = await admin
          .from("rooms").select("production_id").eq("id", member.room_id).maybeSingle();
        productionId = r?.production_id ?? null;
        roomId = member.room_id;
        mode = "invite_only";
        memberName = member.name ?? null;
      }
    }
    if (!productionId || !roomId) return json({ error: "invalid link" }, 404);

    // Sign the scoped JWT with the project's HS256 secret (from app_config).
    const { data: cfg } = await admin.from("app_config").select("value").eq("key", "jwt_secret").maybeSingle();
    const secret = cfg?.value;
    if (!secret) return json({ error: "server not configured (missing jwt_secret)" }, 500);

    const key = new TextEncoder().encode(secret);
    const nowSec = Math.floor(Date.now() / 1000);
    const exp = nowSec + 60 * 60; // 1 hour; the client refreshes by re-calling this fn
    // Claims mirror the anon key's shape (iss/role) plus the scope, so PostgREST +
    // Realtime accept it and treat the caller as the anon DB role with a project scope.
    const jwt = await new SignJWT({
      iss: "supabase",
      role: "anon",
      production_id: productionId,
      room_id: roomId,
      guest_scope: true,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(nowSec)
      .setExpirationTime(exp)
      .sign(key);

    return json({ jwt, productionId, roomId, mode, memberName, expiresAt: exp * 1000 });
  } catch (e) {
    console.error("room-access error:", e);
    return json({ error: String(e) }, 500);
  }
});
