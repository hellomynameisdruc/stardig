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
declare id bigint;
begin
  if not exists (select 1 from public.pilots where id = auth.uid() and admin) then raise exception 'NOT AUTHORISED'; end if;
  if body is null or char_length(trim(body)) = 0 then raise exception 'EMPTY'; end if;
  insert into public.messages (pilot, room, body) values (null, 'all', left(trim(body), 400)) returning messages.id into id;
  return id;
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
