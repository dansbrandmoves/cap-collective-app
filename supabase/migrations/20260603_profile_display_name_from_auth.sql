-- Populate profiles.settings.displayName so guests see the host's real name
-- (not the literal "Host"). Source: auth full_name -> name -> humanized email.

-- Backfill existing profiles, only when displayName is missing.
update public.profiles p
set settings = coalesce(p.settings, '{}'::jsonb)
  || jsonb_build_object(
       'displayName',
       coalesce(
         nullif(u.raw_user_meta_data->>'full_name', ''),
         nullif(u.raw_user_meta_data->>'name', ''),
         initcap(replace(split_part(u.email, '@', 1), '.', ' '))
       )
     )
from auth.users u
where u.id = p.id
  and coalesce(nullif(p.settings->>'displayName', ''), '') = '';

-- Keep it populated for future signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
begin
  insert into public.profiles (id, settings)
  values (
    new.id,
    jsonb_build_object(
      'displayName',
      coalesce(
        nullif(new.raw_user_meta_data->>'full_name', ''),
        nullif(new.raw_user_meta_data->>'name', ''),
        initcap(replace(split_part(new.email, '@', 1), '.', ' '))
      )
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
