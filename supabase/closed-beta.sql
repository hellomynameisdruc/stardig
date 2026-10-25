-- CLOSED BETA: who may listen beyond the open galaxy, chat and broadcast. Access is given by the founder
-- from COMMS (/approve CALLSIGN, /revoke CALLSIGN) or by an invite code (/invite [USES] makes one).
-- Run once in Supabase → SQL Editor (safe to run again).
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
