-- DEAD SIGNALS, SHARED: a video YouTube says is removed (100) or may not be embedded (101/150) is
-- reported by the signed-in pilot who hit it. Two different pilots, or one warden/founder, and it goes
-- dark on everyone's map (web/src/cloud/deadShared.ts). Run once in Supabase → SQL Editor.
create table if not exists public.dead_reports (
  yt text not null check (length(yt) between 6 and 20),
  pilot uuid not null references auth.users (id) on delete cascade,
  code int not null,
  at timestamptz not null default now(),
  primary key (yt, pilot)
);
alter table public.dead_reports enable row level security;   -- no direct reads or writes: only below

create or replace function public.report_dead(yt text, code int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or code not in (100, 101, 150) then return; end if;
  insert into public.dead_reports (yt, pilot, code) values (report_dead.yt, auth.uid(), report_dead.code)
    on conflict do nothing;
end $$;
revoke execute on function public.report_dead(text, int) from public, anon;
grant execute on function public.report_dead(text, int) to authenticated;

-- the list everyone reads: only the video ids, never who reported them
create or replace view public.dead_signals with (security_invoker = false) as
  select d.yt from public.dead_reports d
  left join public.pilots p on p.id = d.pilot
  group by d.yt
  having count(distinct d.pilot) >= 2 or bool_or(coalesce(p.admin or p.rank in ('warden', 'founder'), false));
grant select on public.dead_signals to anon, authenticated;
