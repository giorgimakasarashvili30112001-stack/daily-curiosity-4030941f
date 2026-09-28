-- ANON_CONTENT_POLICIES.sql
-- Run once in your Supabase Dashboard → SQL Editor.
--
-- Why: the app's server code now uses the shared public (anon) Supabase
-- client instead of the service-role admin client. Reads already work, but
-- Row Level Security blocks anon WRITES, so the daily pipeline (claiming the
-- day's explainer, storing generated explainers and quiz questions) silently
-- does nothing. These policies allow exactly the writes the pipeline needs.
--
-- Security note: this lets anyone with the public key insert/update content
-- rows. That key is already shipped in the app, so treat these tables as
-- publicly writable content tables. User data (profiles, quiz_attempts,
-- saved facts) is NOT touched here and stays user-scoped.

-- ============ facts ============
-- Anon can read all facts (already working today, kept for completeness).
drop policy if exists "anon read facts" on public.facts;
create policy "anon read facts"
  on public.facts for select to anon
  using (true);

-- Anon can claim/schedule a pick (server sets pick_date on an unscheduled row).
drop policy if exists "anon update facts" on public.facts;
create policy "anon update facts"
  on public.facts for update to anon
  using (true)
  with check (true);

-- Anon can insert generated explainers (library top-up).
drop policy if exists "anon insert facts" on public.facts;
create policy "anon insert facts"
  on public.facts for insert to anon
  with check (true);

-- ============ quiz_questions ============
drop policy if exists "anon read quiz_questions" on public.quiz_questions;
create policy "anon read quiz_questions"
  on public.quiz_questions for select to anon
  using (true);

drop policy if exists "anon insert quiz_questions" on public.quiz_questions;
create policy "anon insert quiz_questions"
  on public.quiz_questions for insert to anon
  with check (true);

-- ============ verify_cron_token ============
-- The prewarm endpoint verifies the scheduled-job token via this
-- security-definer function; make sure anon may execute it.
grant execute on function public.verify_cron_token(text, text) to anon;
