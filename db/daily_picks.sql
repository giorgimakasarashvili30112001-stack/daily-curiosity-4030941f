-- ============================================================================
-- Daily How — database-native daily pick  (run ONCE in Supabase SQL Editor)
-- ============================================================================
-- Problem this solves: a day's explainer used to be chosen lazily, only when a
-- visitor opened the app (or when the nightly HTTP job reached its "pick" step
-- after calling the website and the AI). If nobody visited and that job failed,
-- the day had NO explainer, and nothing ever went back to fill the gap.
--
-- What this does:
--   * public.ensure_daily_pick(date)    chooses that date's explainer, atomically.
--   * public.backfill_daily_picks(n)    makes sure EVERY day from the first one
--                                       up to today has an explainer, filling any
--                                       missed days (looks back at most n days).
--   * pg_cron job "daily-pick"          runs backfill ONCE A DAY at 00:05 UTC, so each new
--                                       day's explainer is chosen as the day begins. It runs
--                                       entirely inside the database: no website, Cloudflare,
--                                       AI or visitor needed. If a run ever fails, the day is
--                                       still picked the first time someone opens the app, and
--                                       the next night's run fills in anything missed.
--   * Runs a backfill right now, so missed days are filled immediately.
--
-- Selection rules (same as the app's old logic): an unused explainer (pick_date
-- is null); avoid yesterday's category when possible; deterministic rotation by
-- date. If the library of unused explainers is EMPTY, the least recently featured
-- explainer is re-featured as a copy (slug ends in -rYYYYMMDD) so the day is
-- never blank. Keep the library stocked via the nightly prewarm job.
--
-- Safe to run more than once (everything is idempotent).
-- ============================================================================

create extension if not exists pg_cron;

-- ----------------------------------------------------------------------------
-- ensure_daily_pick: returns the fact id for p_date, choosing one if needed.
-- Returns NULL only if there is nothing at all to feature.
-- ----------------------------------------------------------------------------
create or replace function public.ensure_daily_pick(p_date date)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id            uuid;
  v_prev_category text;
  v_even          boolean := (to_char(p_date, 'YYYYMMDD')::int % 2 = 0);
  v_pass          int;
  v_source        public.facts%rowtype;
begin
  -- One chooser per date at a time: concurrent callers wait, then see the pick.
  perform pg_advisory_xact_lock(hashtext('daily_pick:' || p_date::text));

  select id into v_id from public.facts where pick_date = p_date;
  if v_id is not null then
    return v_id;
  end if;

  select category into v_prev_category from public.facts where pick_date = p_date - 1;

  -- Pass 1: unused fact in a different category than yesterday. Pass 2: any unused fact.
  for v_pass in 1..2 loop
    if v_even then
      select id into v_id from public.facts
       where pick_date is null
         and (v_pass = 2 or v_prev_category is null or category <> v_prev_category)
       order by created_at asc, id asc
       limit 1
       for update skip locked;
    else
      select id into v_id from public.facts
       where pick_date is null
         and (v_pass = 2 or v_prev_category is null or category <> v_prev_category)
       order by created_at desc, id desc
       limit 1
       for update skip locked;
    end if;
    exit when v_id is not null;
  end loop;

  if v_id is not null then
    begin
      update public.facts set pick_date = p_date where id = v_id and pick_date is null;
    exception when unique_violation then
      -- Someone else (e.g. the app's fallback path) claimed this date first.
      select id into v_id from public.facts where pick_date = p_date;
    end;
    return v_id;
  end if;

  -- Library exhausted: re-feature the least recently featured original as a copy
  -- (each fact carries a single pick_date, so a copy is needed). Copies whatever
  -- columns the table has, so it works whether or not optional columns exist.
  select f.* into v_source
    from public.facts f
   where f.pick_date is not null
     and f.pick_date < p_date
     and f.slug !~ '-r[0-9]{8}$'
   order by (select count(*) from public.facts c where c.slug like f.slug || '-r%'),
            f.pick_date asc
   limit 1;

  if v_source.id is null then
    return null;  -- nothing has ever been featured and nothing is unused
  end if;

  insert into public.facts
  select * from jsonb_populate_record(
    null::public.facts,
    to_jsonb(v_source) || jsonb_build_object(
      'id',         gen_random_uuid(),
      'slug',       v_source.slug || '-r' || to_char(p_date, 'YYYYMMDD'),
      'pick_date',  p_date,
      'created_at', now()
    )
  )
  returning id into v_id;

  raise warning 'daily_pick: library empty on %, re-featured "%" as a copy. Stock the library (prewarm job / AI key).',
    p_date, v_source.title;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- backfill_daily_picks: guarantees a pick for every day up to today.
-- Starts at the earliest day that ever had a pick (never invents history before
-- the app began) and looks back at most p_max_days days. Returns days filled.
-- ----------------------------------------------------------------------------
create or replace function public.backfill_daily_picks(p_max_days int default 30)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_first date;
  v_start date;
  v_day   date;
  v_count int := 0;
begin
  select min(pick_date) into v_first from public.facts where pick_date is not null;
  v_start := greatest(v_today - (greatest(p_max_days, 1) - 1), coalesce(v_first, v_today));

  -- Oldest first so the "not the same category two days running" rule holds.
  for v_day in select d::date from generate_series(v_start, v_today, interval '1 day') as d loop
    if not exists (select 1 from public.facts where pick_date = v_day) then
      if public.ensure_daily_pick(v_day) is not null then
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

-- Only the database itself (pg_cron) and the app's service role may call these.
revoke all on function public.ensure_daily_pick(date)    from public, anon, authenticated;
revoke all on function public.backfill_daily_picks(int)  from public, anon, authenticated;
grant execute on function public.ensure_daily_pick(date)   to service_role;
grant execute on function public.backfill_daily_picks(int) to service_role;

-- ----------------------------------------------------------------------------
-- Daily job at 00:05 UTC. Re-running this file replaces the job of the same name
-- (so it also replaces an older hourly version of this job).
-- ----------------------------------------------------------------------------
select cron.schedule(
  'daily-pick',
  '5 0 * * *',
  $$ select public.backfill_daily_picks(); $$
);

-- Fill any missed days right now.
select public.backfill_daily_picks() as days_filled;

-- ============================================================================
-- Useful checks afterwards:
--   select pick_date, title from public.facts
--    where pick_date is not null order by pick_date desc limit 10;   -- no gaps
--   select count(*) as unused from public.facts where pick_date is null;
--   select * from cron.job where jobname = 'daily-pick';
--   select * from cron.job_run_details order by start_time desc limit 10;
-- ============================================================================
