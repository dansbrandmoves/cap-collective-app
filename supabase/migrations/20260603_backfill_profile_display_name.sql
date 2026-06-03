-- One-time backfill: existing owners had no settings.displayName, so guests saw
-- the generic "Coordinator" fallback as their NAME. Pull a real name from auth
-- metadata (Google/MS full_name → name → email local-part). Only fills blanks.
update public.profiles p
set settings = jsonb_set(coalesce(p.settings, '{}'::jsonb), '{displayName}', to_jsonb(
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    split_part(u.email, '@', 1)
  )
))
from auth.users u
where p.id = u.id
  and coalesce(nullif(p.settings->>'displayName', ''), '') = ''
  and coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    split_part(u.email, '@', 1)
  ) is not null;
