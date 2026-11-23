-- LIVE: DJ sets streaming right now on the set channels, placed in styles by the Edge Function
-- "live-sets" (supabase/functions/live-sets). The map reads this table and lights those stars up.
-- Run once in Supabase → SQL Editor, after the function is deployed and its secret YT_API_KEY is set.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.live_sets (
  v text primary key,                 -- the YouTube video id of the stream
  t text not null,                    -- its title
  c text not null,                    -- the channel
  stars text[] not null,              -- the styles it's placed in (star names)
  viewers int not null default 0,
  started timestamptz,
  seen timestamptz not null default now()
);
alter table public.live_sets enable row level security;
drop policy if exists "live sets are public" on public.live_sets;
create policy "live sets are public" on public.live_sets for select to anon, authenticated using (true);
-- written only by the function (with the service key, past these rules)

-- every 10 minutes: ask the function to look (the anon key is public; it only lets the call through)
select cron.unschedule('stardig-live') where exists (select 1 from cron.job where jobname = 'stardig-live');
select cron.schedule('stardig-live', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://muuaqquhqgthkfzlqkvq.supabase.co/functions/v1/live-sets',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11dWFxcXVocWd0aGtmemxxa3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NzIwNjIsImV4cCI6MjEwODM0ODA2Mn0.AksqrtNhZsdUJTMj04UDPpsXezaWqsIlK6w_4mAfFYk'),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);
