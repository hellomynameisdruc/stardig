-- stardig (formerly Sound Cosmos): pilots (profiles) and comms (chat). Run once in Supabase → SQL Editor.

-- PILOTS: one per account, made on sign-up with a call sign the pilot can change
create table public.pilots (
  id uuid primary key references auth.users on delete cascade,
  nick text not null unique check (nick ~ '^[A-Za-z0-9_.-]{3,20}$'),
  avatar int not null default floor(random() * 2147483647)::int,
  created_at timestamptz not null default now()
);
alter table public.pilots enable row level security;
create policy "pilots are public" on public.pilots for select using (true);
create policy "pilots edit themselves" on public.pilots for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
grant select on public.pilots to anon, authenticated;
grant update (nick, avatar) on public.pilots to authenticated;

create function public.new_pilot() returns trigger language plpgsql security definer set search_path = public as $$
declare n text;
begin
  loop
    n := 'PILOT-' || upper(substr(md5(random()::text), 1, 5));
    exit when not exists (select 1 from public.pilots where nick = n);
  end loop;
  insert into public.pilots (id, nick) values (new.id, n);
  return new;
end $$;
create trigger on_signup after insert on auth.users for each row execute function public.new_pilot();

-- COMMS: messages in rooms ("all", or a style's own frequency)
create table public.messages (
  id bigint generated always as identity primary key,
  room text not null check (room ~ '^[a-z0-9:_-]{1,40}$'),
  pilot uuid not null default auth.uid() references public.pilots on delete cascade,
  body text not null check (char_length(body) between 1 and 400),
  created_at timestamptz not null default now()
);
create index on public.messages (room, created_at desc);
alter table public.messages enable row level security;

-- REPORTS: three reports hide a message
create table public.reports (
  message bigint references public.messages on delete cascade,
  reporter uuid not null default auth.uid() references public.pilots on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message, reporter)
);
alter table public.reports enable row level security;
create policy "pilots report" on public.reports for insert to authenticated with check (reporter = auth.uid());
grant insert (message) on public.reports to authenticated;

create function public.hidden(m bigint) returns boolean language sql stable security definer set search_path = public as $$
  select count(*) >= 3 from public.reports where message = m
$$;

create policy "comms are public" on public.messages for select using (not public.hidden(id));
create policy "pilots transmit as themselves" on public.messages for insert to authenticated with check (pilot = auth.uid());
create policy "pilots delete their own" on public.messages for delete to authenticated using (pilot = auth.uid());
grant select on public.messages to anon, authenticated;
grant insert (room, body) on public.messages to authenticated;
grant delete on public.messages to authenticated;

-- flood control: one message per 3 s, at most 20 in 5 minutes
create function public.flood_control() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.messages where pilot = new.pilot and created_at > now() - interval '3 seconds')
     or (select count(*) from public.messages where pilot = new.pilot and created_at > now() - interval '5 minutes') >= 20 then
    raise exception 'TOO FAST';
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger flood before insert on public.messages for each row execute function public.flood_control();

-- a pilot can delete their account and everything in it
create function public.delete_me() returns void language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid()
$$;
revoke execute on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;

-- live updates for the chat
alter publication supabase_realtime add table public.messages;

-- RANKS: given by the founder from COMMS (/rank CALLSIGN RANK); wardens and the founder keep the channel clean
alter table public.pilots add column rank text not null default 'cadet'
  check (rank in ('cadet','pilot','navigator','captain','commander','admiral','dj','digger','warden','founder'));
alter table public.pilots add column admin boolean not null default false;

create function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pilots where id = auth.uid() and (admin or rank in ('warden','founder')))
$$;
create policy "staff delete any message" on public.messages for delete to authenticated using (public.is_staff());

create function public.grant_rank(target text, new_rank text) returns text language plpgsql security definer set search_path = public as $$
declare n text;
begin
  if not exists (select 1 from public.pilots where id = auth.uid() and admin) then raise exception 'NOT AUTHORISED'; end if;
  update public.pilots set rank = lower(new_rank) where lower(nick) = lower(target) returning nick into n;
  if n is null then raise exception 'NO SUCH PILOT'; end if;
  return n;
end $$;
revoke execute on function public.grant_rank(text, text) from public, anon;
grant execute on function public.grant_rank(text, text) to authenticated;

-- the first pilot to sign up (the founder) gets the keys
update public.pilots set admin = true, rank = 'founder' where id = (select id from auth.users order by created_at limit 1);
-- LOGBOOKS: a pilot's beacons and flight log, kept with the account
create table public.logbooks (
  pilot uuid primary key default auth.uid() references public.pilots on delete cascade,
  beacons jsonb not null default '[]',
  gone jsonb not null default '{}',
  flights jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  check (pg_column_size(beacons) + pg_column_size(gone) + pg_column_size(flights) < 400000)
);
alter table public.logbooks enable row level security;
create policy "pilots keep their own logbook" on public.logbooks for all to authenticated
  using (pilot = auth.uid()) with check (pilot = auth.uid());
grant select, insert, update on public.logbooks to authenticated;

-- FLEET CHAT: stored like the open channel (so nobody can speak under another's name), and it fades:
-- a fleet's messages are gone after six hours
create function public.fleet_chat_fades() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.messages where room like 'f:%' and created_at < now() - interval '6 hours';
  return null;
end $$;
create trigger fleet_chat_fades after insert on public.messages for each statement execute function public.fleet_chat_fades();

-- LIVE CHANNELS: anyone may listen; signed-in pilots may show up; only a fleet's own host steers it
create policy "anyone listens" on realtime.messages for select to anon, authenticated
  using (realtime.topic() = 'onair' or realtime.topic() like 'fleet:%' or realtime.topic() like 'comms:%');
create policy "pilots show up" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'presence' and (realtime.topic() = 'onair' or realtime.topic() like 'fleet:%'));
create policy "only the host steers" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and realtime.topic() = 'fleet:' || auth.uid()::text);

-- CLOSED BETA (also in closed-beta.sql): access by the founder (/approve, /revoke) or an invite code (/invite)
alter table public.pilots add column if not exists access boolean not null default false;
update public.pilots set access = true where admin or rank in ('warden', 'founder');

create table if not exists public.invites (
  code text primary key,
  uses int not null default 0,
  max_uses int not null default 1 check (max_uses between 1 and 1000),
  made_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.invites enable row level security; -- no policies: only the functions below touch it

create or replace function public.grant_access(target text, allow boolean) returns text
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  if not exists (select 1 from public.pilots where id = auth.uid() and admin) then raise exception 'NOT AUTHORISED'; end if;
  update public.pilots set access = allow where lower(nick) = lower(target) returning nick into n;
  if n is null then raise exception 'NO SUCH PILOT'; end if;
  return n;
end $$;

create or replace function public.make_invite(uses int default 1) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not exists (select 1 from public.pilots where id = auth.uid() and admin) then raise exception 'NOT AUTHORISED'; end if;
  c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into public.invites (code, max_uses, made_by) values (c, greatest(1, least(uses, 1000)), auth.uid());
  return c;
end $$;

create or replace function public.redeem_invite(code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if auth.uid() is null then return false; end if;
  update public.invites i set uses = i.uses + 1 where i.code = upper(trim(redeem_invite.code)) and i.uses < i.max_uses returning i.code into k;
  if k is null then return false; end if;
  update public.pilots set access = true where id = auth.uid();
  return true;
end $$;

revoke execute on function public.grant_access(text, boolean) from public, anon;
revoke execute on function public.make_invite(int) from public, anon;
revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.grant_access(text, boolean) to authenticated;
grant execute on function public.make_invite(int) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;

-- only pilots with access transmit in COMMS
drop policy if exists "pilots transmit as themselves" on public.messages;
create policy "pilots transmit as themselves" on public.messages for insert to authenticated
  with check (pilot = auth.uid() and exists (select 1 from public.pilots where id = auth.uid() and (access or admin)));

-- the founder hears about new pilots and invites used, live
do $$ begin
  alter publication supabase_realtime add table public.pilots;
exception when duplicate_object then null; end $$;

-- REACTIONS AND REPLIES (also in reactions.sql)
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
