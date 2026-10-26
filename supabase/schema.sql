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

-- EARNED RANKS (also in ranks-earned.sql)

create or replace function public.claim_rank() returns text
language plpgsql security definer set search_path = public as $$
declare f jsonb; flights int := 0; ore int := 0; cur text; earned text := 'cadet';
  ladder text[] := array['cadet','pilot','navigator','captain','commander','admiral'];
begin
  if auth.uid() is null then return null; end if;
  select rank into cur from public.pilots where id = auth.uid();
  if cur is null or not (cur = any(ladder)) then return cur; end if; -- given ranks are kept
  select flights into f from public.logbooks where pilot = auth.uid();
  if f is not null and jsonb_typeof(f) = 'object' then
    select coalesce(sum(least(value::text::numeric, 100000)), 0)::int into flights from jsonb_each(coalesce(f->'count', '{}'::jsonb)) where jsonb_typeof(value) = 'number';
    if jsonb_typeof(f->'ore') = 'array' then ore := jsonb_array_length(f->'ore'); end if;
  end if;
  earned := case
    when flights >= 2000 or ore >= 500 then 'admiral'
    when flights >= 750 or ore >= 200 then 'commander'
    when flights >= 300 or ore >= 75 then 'captain'
    when flights >= 100 or ore >= 25 then 'navigator'
    when flights >= 25 or ore >= 5 then 'pilot'
    else 'cadet' end;
  if array_position(ladder, earned) > array_position(ladder, cur) then
    update public.pilots set rank = earned where id = auth.uid();
    return earned;
  end if;
  return cur;
end $$;
revoke execute on function public.claim_rank() from public, anon;
grant execute on function public.claim_rank() to authenticated;

-- the founder's rank stays the founder's: nobody is given it, and the founder's rank isn't changed
create or replace function public.grant_rank(target text, new_rank text) returns text language plpgsql security definer set search_path = public as $$
declare n text;
begin
  if not exists (select 1 from public.pilots where id = auth.uid() and admin) then raise exception 'NOT AUTHORISED'; end if;
  if lower(new_rank) = 'founder' then raise exception 'NOT GIVEN'; end if;
  update public.pilots set rank = lower(new_rank) where lower(nick) = lower(target) and rank <> 'founder' returning nick into n;
  if n is null then raise exception 'NO SUCH PILOT'; end if;
  return n;
end $$;

-- SYSTEM WELCOMES: when a pilot is let into the beta (/approve or an invite code), the station itself
-- says so in COMMS · ALL. Its messages have no pilot (pilot is null): the site draws them as SYSTEM.
alter table public.messages alter column pilot drop not null;

create or replace function public.welcome_pilot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.access and not coalesce(old.access, false) and not coalesce(new.admin, false) then
    insert into public.messages (pilot, room, body)
    values (null, 'all', '◆ NEW PILOT IN THE RANKS: ' || upper(new.nick) || '. WELCOME ABOARD, CLEAR SKIES AND GOOD DIGGING.');
  end if;
  return new;
end $$;
revoke execute on function public.welcome_pilot() from public, anon, authenticated;

drop trigger if exists welcome_pilot on public.pilots;
create trigger welcome_pilot after update of access on public.pilots for each row execute function public.welcome_pilot();

-- SYSTEM, the station's voice in COMMS (pilot is null), and letting everyone waiting in at once.
-- Run after welcome.sql (or on its own: it includes the welcome).
alter table public.messages alter column pilot drop not null;

-- each pilot let in is welcomed; /approve all welcomes them together, in one message
create or replace function public.welcome_pilot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.access and not coalesce(old.access, false) and not coalesce(new.admin, false)
     and coalesce(current_setting('stardig.quiet', true), '') <> '1' then
    insert into public.messages (pilot, room, body)
    values (null, 'all', '◆ NEW PILOT IN THE RANKS: ' || upper(new.nick) || '. WELCOME ABOARD, CLEAR SKIES AND GOOD DIGGING.');
  end if;
  return new;
end $$;
revoke execute on function public.welcome_pilot() from public, anon, authenticated;
drop trigger if exists welcome_pilot on public.pilots;
create trigger welcome_pilot after update of access on public.pilots for each row execute function public.welcome_pilot();

-- the founder speaks as SYSTEM (/sys, /tip, /pilots, /welcome)
create or replace function public.system_say(body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare said bigint;
begin
  if not exists (select 1 from public.pilots p where p.id = auth.uid() and p.admin) then raise exception 'NOT AUTHORISED'; end if;
  if body is null or char_length(trim(body)) = 0 then raise exception 'EMPTY'; end if;
  insert into public.messages (pilot, room, body) values (null, 'all', left(trim(body), 400)) returning messages.id into said;
  return said;
end $$;
revoke execute on function public.system_say(text) from public, anon;
grant execute on function public.system_say(text) to authenticated;

-- /approve all: everyone waiting is let in; SYSTEM welcomes them in one message
create or replace function public.approve_all() returns int
language plpgsql security definer set search_path = public as $$
declare names text[];
begin
  if not exists (select 1 from public.pilots where id = auth.uid() and admin) then raise exception 'NOT AUTHORISED'; end if;
  perform set_config('stardig.quiet', '1', true);
  with let_in as (update public.pilots set access = true where not access and not admin returning nick)
  select array_agg(upper(nick) order by nick) into names from let_in;
  perform set_config('stardig.quiet', '', true);
  if names is null then return 0; end if;
  insert into public.messages (pilot, room, body) values (null, 'all', left(
    '◆ ' || array_length(names, 1) || ' NEW ' || case when array_length(names, 1) = 1 then 'PILOT' else 'PILOTS' end
    || ' IN THE RANKS: ' || array_to_string(names, ', ') || '. WELCOME ABOARD, CLEAR SKIES AND GOOD DIGGING.', 400));
  return array_length(names, 1);
end $$;
revoke execute on function public.approve_all() from public, anon;
grant execute on function public.approve_all() to authenticated;
