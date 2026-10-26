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
