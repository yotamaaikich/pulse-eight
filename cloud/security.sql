create schema if not exists pulse_private;
revoke all on schema pulse_private from public,anon,authenticated;
grant usage on schema pulse_private to service_role;
create table if not exists pulse_private.request_budgets (
  bucket text primary key,
  window_start timestamptz not null,
  used integer not null check(used>=0)
);
alter table pulse_private.request_budgets enable row level security;
create index if not exists request_budgets_expiry on pulse_private.request_budgets(window_start);
revoke all on pulse_private.request_budgets from public,anon,authenticated;
grant select,insert,update,delete on pulse_private.request_budgets to service_role;
create or replace function public.pulse_keys_consume_budget(p_category text,p_key text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare
  period timestamptz := date_trunc('minute',clock_timestamp());
  global_key text := 'global:'||p_category;
  client_key text := p_category||':'||p_key;
  global_limit integer;
  client_limit integer;
  current_row pulse_private.request_budgets%rowtype;
  accepted integer;
begin
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid budget key'; end if;
  case p_category
    when 'read' then global_limit:=1200;client_limit:=120;
    when 'write' then global_limit:=240;client_limit:=30;
    when 'account' then global_limit:=600;client_limit:=60;
    else raise exception 'Invalid budget category';
  end case;
  insert into pulse_private.request_budgets values(global_key,period,0) on conflict do nothing;
  select * into current_row from pulse_private.request_budgets where bucket=global_key for update;
  period:=date_trunc('minute',clock_timestamp());
  if current_row.window_start<>period then
    update pulse_private.request_budgets set window_start=period,used=0 where bucket=global_key;
    current_row.used:=0;
  end if;
  if current_row.used>=global_limit then return false;end if;
  insert into pulse_private.request_budgets values(client_key,period,1)
  on conflict(bucket) do update set window_start=period,
    used=case when request_budgets.window_start=period then request_budgets.used+1 else 1 end
  where request_budgets.window_start<>period or request_budgets.used<client_limit
  returning used into accepted;
  if accepted is null then return false;end if;
  update pulse_private.request_budgets set used=used+1 where bucket=global_key;
  if random()<0.01 then delete from pulse_private.request_budgets where bucket in(select bucket from pulse_private.request_budgets where window_start<period-interval '2 hours' limit 100 for update skip locked);end if;
  return true;
end;
$$;
revoke execute on function public.pulse_keys_consume_budget(text,text) from public,anon,authenticated;
grant execute on function public.pulse_keys_consume_budget(text,text) to service_role;
-- These tables are intentionally server-only, including retired chart tables.
create policy pulse_server_only on public.pulse_keys_runs for all to anon,authenticated using(false) with check(false);
create policy pulse_server_only on public.pulse_keys_scores for all to anon,authenticated using(false) with check(false);
create policy pulse_server_only on public.pulse_keys_charts for all to anon,authenticated using(false) with check(false);
create policy pulse_server_only on public.pulse_keys_chart_scores for all to anon,authenticated using(false) with check(false);
create policy pulse_server_only on pulse_private.request_budgets for all to anon,authenticated using(false) with check(false);
