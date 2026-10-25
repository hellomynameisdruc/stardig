-- REACTIONS AND REPLIES in COMMS. Run once in Supabase → SQL Editor (safe to run again).
-- A reply points at the message it answers
alter table public.messages add column if not exists reply_to bigint references public.messages on delete set null;
grant insert (room, body, reply_to) on public.messages to authenticated;

-- a pilot's reactions to a message: one of each kind at most
create table if not exists public.reactions (
  message bigint not null references public.messages on delete cascade,
  pilot uuid not null default auth.uid() references public.pilots on delete cascade,
  kind text not null check (kind in ('love', 'banger', 'rare', 'respect')),
  created_at timestamptz not null default now(),
  primary key (message, pilot, kind)
);
alter table public.reactions enable row level security;
drop policy if exists "reactions are public" on public.reactions;
drop policy if exists "pilots react as themselves" on public.reactions;
drop policy if exists "pilots take back their own" on public.reactions;
create policy "reactions are public" on public.reactions for select using (true);
create policy "pilots react as themselves" on public.reactions for insert to authenticated
  with check (pilot = auth.uid() and exists (select 1 from public.pilots where id = auth.uid() and (access or admin)));
create policy "pilots take back their own" on public.reactions for delete to authenticated using (pilot = auth.uid());
grant select on public.reactions to anon, authenticated;
grant insert (message, kind) on public.reactions to authenticated;
grant delete on public.reactions to authenticated;
alter table public.reactions replica identity full; -- a taken-back reaction reaches the others whole
do $$ begin
  alter publication supabase_realtime add table public.reactions;
exception when duplicate_object then null; end $$;
