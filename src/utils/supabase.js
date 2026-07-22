import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('Supabase env vars not set — real-time and sharing features disabled.')
}

export const supabase = createClient(url ?? '', key ?? '')

// A guest gets a short-lived JWT (minted by the room-access edge fn) that scopes
// them to one project. This builds a SECOND client that sends that JWT on every
// REST request and on the realtime socket, so row-level security enforces the
// scope for both. persistSession:false keeps it from touching the owner's auth
// storage; it's a pure bearer-token client.
export function makeScopedClient(jwt) {
  const c = createClient(url ?? '', key ?? '', {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  c.realtime.setAuth(jwt)
  return c
}
