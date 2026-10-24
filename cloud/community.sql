create table if not exists public.pulse_keys_charts (
  id uuid primary key default gen_random_uuid(),
  creator_hash text not null check (creator_hash ~ '^[a-f0-9]{64}$'),
  creator_name text not null check (char_length(creator_name) between 1 and 16),
  title text not null check (char_length(title) between 1 and 32),
  song text not null,
  difficulty integer not null check (difficulty between 0 and 2),
  chart_version text not null,
  chart_hash text not null check (chart_hash ~ '^[a-f0-9]{64}$'),
  duration_seconds integer not null check (duration_seconds between 2 and 600),
  notes jsonb not null check (jsonb_typeof(notes)='array'),
  note_count integer not null check (note_count between 1 and 4096),
  verified_score integer not null check (verified_score between 0 and 1000000),
  published_at timestamptz not null default now(),
  unique (creator_hash,song,chart_hash)
);
create index if not exists pulse_keys_charts_browse on public.pulse_keys_charts(song,chart_version,published_at desc);
alter table public.pulse_keys_charts enable row level security;
revoke all on public.pulse_keys_charts from public,anon,authenticated;
grant all on public.pulse_keys_charts to service_role;
alter table public.pulse_keys_runs add column if not exists duration_seconds integer;
alter table public.pulse_keys_runs add column if not exists chart_id uuid references public.pulse_keys_charts(id);
alter table public.pulse_keys_runs add column if not exists draft_notes jsonb;
alter table public.pulse_keys_runs add column if not exists draft_hash text;
alter table public.pulse_keys_runs add column if not exists draft_title text;
create index if not exists pulse_keys_runs_chart on public.pulse_keys_runs(chart_id) where chart_id is not null;
create table if not exists public.pulse_keys_chart_scores (
  player_hash text not null check (player_hash ~ '^[a-f0-9]{64}$'),
  chart_id uuid not null references public.pulse_keys_charts(id),
  name text not null check (char_length(name) between 1 and 16),
  score integer not null check (score between 0 and 1000000),
  accuracy numeric(5,2) not null check (accuracy between 0 and 100),
  max_combo integer not null check (max_combo>=0),
  updated_at timestamptz not null default now(),
  primary key (player_hash,chart_id)
);
create index if not exists pulse_keys_chart_scores_ranking on public.pulse_keys_chart_scores(chart_id,score desc,accuracy desc,updated_at asc);
alter table public.pulse_keys_chart_scores enable row level security;
revoke all on public.pulse_keys_chart_scores from public,anon,authenticated;
grant all on public.pulse_keys_chart_scores to service_role;
create or replace function public.pulse_keys_save_chart_best(p_player text,p_chart uuid,p_name text,p_score integer,p_accuracy numeric,p_combo integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
  insert into public.pulse_keys_chart_scores(player_hash,chart_id,name,score,accuracy,max_combo)
  values(p_player,p_chart,p_name,p_score,p_accuracy,p_combo)
  on conflict(player_hash,chart_id) do update set name=excluded.name,score=excluded.score,accuracy=excluded.accuracy,max_combo=excluded.max_combo,updated_at=now()
  where excluded.score>public.pulse_keys_chart_scores.score;
  get diagnostics changed=row_count;
  return changed>0;
end $$;
revoke all on function public.pulse_keys_save_chart_best(text,uuid,text,integer,numeric,integer) from public,anon,authenticated;
grant execute on function public.pulse_keys_save_chart_best(text,uuid,text,integer,numeric,integer) to service_role;
create or replace function public.pulse_keys_publish_chart(p_run uuid,p_player text,p_name text,p_score integer,p_accuracy numeric,p_combo integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare run public.pulse_keys_runs%rowtype; published uuid;
begin
  select * into run from public.pulse_keys_runs where id=p_run and player_hash=p_player for update;
  if not found or run.draft_notes is null then raise exception 'draft run not found'; end if;
  if run.used then
    if run.chart_id is not null then return run.chart_id; end if;
    raise exception 'run already used';
  end if;
  if run.duration_seconds is null or now()-run.created_at<make_interval(secs=>run.duration_seconds-2) or now()-run.created_at>interval '30 minutes' then raise exception 'run not finished'; end if;
  if p_combo<>jsonb_array_length(run.draft_notes) or p_combo<1 then raise exception 'full combo required'; end if;
  insert into public.pulse_keys_charts(creator_hash,creator_name,title,song,difficulty,chart_version,chart_hash,duration_seconds,notes,note_count,verified_score)
  values(p_player,p_name,run.draft_title,run.song,run.difficulty,run.chart_version,run.draft_hash,run.duration_seconds,run.draft_notes,p_combo,p_score)
  on conflict(creator_hash,song,chart_hash) do nothing returning id into published;
  if published is null then select id into published from public.pulse_keys_charts where creator_hash=p_player and song=run.song and chart_hash=run.draft_hash; end if;
  update public.pulse_keys_runs set used=true,chart_id=published where id=p_run;
  perform public.pulse_keys_save_chart_best(p_player,published,p_name,p_score,p_accuracy,p_combo);
  return published;
end $$;
revoke all on function public.pulse_keys_publish_chart(uuid,text,text,integer,numeric,integer) from public,anon,authenticated;
grant execute on function public.pulse_keys_publish_chart(uuid,text,text,integer,numeric,integer) to service_role;
