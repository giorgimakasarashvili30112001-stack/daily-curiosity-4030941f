-- ============================================================================
-- The Daily How — daily content scheduler (run ONCE in Supabase SQL Editor)
-- ============================================================================
-- What this does:
--   Every day at 00:05 UTC your database calls the app's /api/public/prewarm
--   endpoint, which reserves that day's explainer and generates its quiz
--   question — even if nobody opens the app.
--
-- How to apply:
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--   Safe to run more than once (everything is idempotent).
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Private schema: not exposed through the Data API, so tokens stay hidden.
create schema if not exists private;

-- Bearer tokens used by scheduled jobs when calling app endpoints.
create table if not exists private.cron_tokens (
  name text primary key,
  token text not null default encode(gen_random_bytes(24), 'hex')
);

-- Generate the prewarm token once (kept on re-runs).
insert into private.cron_tokens (name) values ('prewarm')
on conflict (name) do nothing;

-- Verification helper the app endpoint calls with the service-role key.
-- Security definer so it can read the private schema; only service_role may execute it.
create or replace function public.verify_cron_token(p_name text, p_token text)
returns boolean
language sql
security definer
set search_path = private, public
as $$
  select exists (
    select 1 from private.cron_tokens
    where name = p_name and token = p_token
  );
$$;

revoke all on function public.verify_cron_token(text, text) from public, anon, authenticated;
grant execute on function public.verify_cron_token(text, text) to service_role;

-- The daily job. Runs at 00:05 UTC; scheduling again with the same name
-- replaces the existing job, so re-running this file is safe.
select cron.schedule(
  'daily-prewarm',
  '5 0 * * *',
  $$
  select net.http_post(
    url := 'https://id-preview--da48e79e-7637-4feb-aebb-caf91dd115b6.lovable.app/api/public/prewarm',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select token from private.cron_tokens where name = 'prewarm')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- Useful checks afterwards:
--   select * from cron.job;                          -- the scheduled job
--   select * from cron.job_run_details               -- run history / errors
--     order by start_time desc limit 10;
-- To change the URL after publishing your own domain, re-run the
-- cron.schedule(...) call above with the new url.
-- ============================================================================
