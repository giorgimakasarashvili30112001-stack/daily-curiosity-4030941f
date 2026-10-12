-- Rewarded-ad coins. Run once in the Supabase SQL Editor.
-- Coins are only ever granted by the server after Google AdMob confirms an ad was
-- watched (server-side verification), through this function. Clients cannot call it.
create table if not exists public.ad_rewards (
  transaction_id text primary key,          -- AdMob's unique id: stops double-crediting
  user_id        uuid not null,
  coins          integer not null,
  created_at     timestamptz not null default now()
);
create index if not exists ad_rewards_user_day on public.ad_rewards (user_id, created_at);
alter table public.ad_rewards enable row level security;   -- no policies: invisible to clients
revoke all on public.ad_rewards from anon, authenticated;

create or replace function public.grant_ad_reward(
  p_user uuid, p_tx text, p_coins integer, p_daily_cap integer default 10
) returns text
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if exists (select 1 from ad_rewards where transaction_id = p_tx) then return 'duplicate'; end if;
  select count(*) into n from ad_rewards
    where user_id = p_user and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if n >= p_daily_cap then return 'capped'; end if;
  if not exists (select 1 from profiles where id = p_user) then return 'no_user'; end if;
  insert into ad_rewards (transaction_id, user_id, coins) values (p_tx, p_user, p_coins);
  update profiles set coins = coins + p_coins, updated_at = now() where id = p_user;
  return 'granted';
end $$;
revoke all on function public.grant_ad_reward(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.grant_ad_reward(uuid, text, integer, integer) to service_role;
