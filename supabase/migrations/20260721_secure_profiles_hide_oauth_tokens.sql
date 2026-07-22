-- SECURITY: profiles held google_/ms_ refresh + access tokens AND had a blanket
-- "Anon can read profiles" SELECT policy (USING true, role public), so the public
-- anon key could read every user's calendar OAuth tokens. RLS filters rows, not
-- columns, so we remove the blanket read and expose only non-sensitive columns to
-- collaborators through a view. Owners still read their own row (incl. tokens for
-- refresh) via auth.uid()=id; edge functions use the service role.

drop policy if exists "Anon can read profiles" on public.profiles;

-- Safe projection for guests/members. NEVER add token columns here. settings is a
-- jsonb blob (displayName, email, timezone, booking theme, etc.) that guests
-- legitimately need; it must never be used to store secrets.
create or replace view public.public_profiles
  with (security_invoker = false) as
  select id, logo_url, logo_is_dark, avatar_url, connected_calendars, settings
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;
