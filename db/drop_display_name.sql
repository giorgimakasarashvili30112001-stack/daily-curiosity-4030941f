-- Removes profiles.display_name (no longer used by the app).
-- Run AFTER the app version that no longer reads display_name is deployed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

alter table public.profiles drop column if exists display_name;
