-- EARNED RANKS: cadet → pilot → navigator → captain → commander → admiral come from digging — flights
-- logged (tracks played) or ore mined (asteroid-belt tracks dug up), whichever is further along. DJ,
-- DIGGER and WARDEN are only given by the founder; the founder's own rank (shown as ARCHITECT) is never
-- given to anyone. Run once in Supabase → SQL Editor (safe to run again).

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
