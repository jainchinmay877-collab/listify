-- Per-user daily usage counter. Only the server (service_role) can change it.
create table if not exists public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  count int not null default 0 check (count >= 0),
  primary key (user_id, day)
);

alter table public.usage_daily enable row level security;

-- Users may read only their own rows. No insert/update/delete policies exist.
drop policy if exists "read own usage" on public.usage_daily;
create policy "read own usage" on public.usage_daily
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.usage_daily from anon;
revoke insert, update, delete, truncate on public.usage_daily from authenticated;

-- Atomically uses one credit. Returns credits left, or -1 if the daily limit is reached.
create or replace function public.consume_quota(p_user uuid, p_limit int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_day date := (now() at time zone 'utc')::date;
begin
  insert into public.usage_daily (user_id, day, count)
  values (p_user, v_day, 0)
  on conflict (user_id, day) do nothing;

  update public.usage_daily
     set count = count + 1
   where user_id = p_user and day = v_day and count < p_limit
  returning count into v_count;

  if v_count is null then
    return -1;
  end if;
  return p_limit - v_count;
end;
$$;

create or replace function public.refund_quota(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.usage_daily
     set count = greatest(count - 1, 0)
   where user_id = p_user and day = (now() at time zone 'utc')::date;
$$;

-- Only the server may call these. Signed-in users can NOT reset their own quota.
revoke all on function public.consume_quota(uuid, int) from public, anon, authenticated;
revoke all on function public.refund_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_quota(uuid, int) to service_role;
grant execute on function public.refund_quota(uuid) to service_role;
