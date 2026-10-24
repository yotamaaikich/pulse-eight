-- Isolated tables for PULSE EIGHT. No browser may read or write these directly.
create table public.pulse_keys_runs (
  id uuid primary key default gen_random_uuid(),
  player_hash text not null,
  song text not null,
  difficulty smallint not null check(difficulty between 0 and 2),
  chart_version text not null,
  created_at timestamptz not null default now(),
  used boolean not null default false
);
create index pulse_keys_runs_player_created on public.pulse_keys_runs(player_hash,created_at desc);
create index pulse_keys_runs_created on public.pulse_keys_runs(created_at);
alter table public.pulse_keys_runs enable row level security;
revoke all on public.pulse_keys_runs from anon,authenticated;
grant select,insert,update,delete on public.pulse_keys_runs to service_role;

create table public.pulse_keys_scores (
  player_hash text not null,
  song text not null,
  difficulty smallint not null check(difficulty between 0 and 2),
  chart_version text not null,
  name text not null check(char_length(name) between 1 and 16),
  score integer not null check(score between 0 and 1000000),
  accuracy numeric(5,2) not null check(accuracy between 0 and 100),
  max_combo integer not null check(max_combo between 0 and 4096),
  updated_at timestamptz not null default now(),
  primary key(player_hash,song,difficulty,chart_version)
);
create index pulse_keys_scores_ranking on public.pulse_keys_scores(song,difficulty,chart_version,score desc,accuracy desc,updated_at asc);
alter table public.pulse_keys_scores enable row level security;
revoke all on public.pulse_keys_scores from anon,authenticated;
grant select,insert,update on public.pulse_keys_scores to service_role;

-- Invoker rights; only the server role can execute this atomic best-score upsert.
create function public.pulse_keys_save_best(p_player text,p_song text,p_difficulty smallint,p_version text,p_name text,p_score integer,p_accuracy numeric,p_combo integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  insert into public.pulse_keys_scores(player_hash,song,difficulty,chart_version,name,score,accuracy,max_combo)
  values(p_player,p_song,p_difficulty,p_version,p_name,p_score,p_accuracy,p_combo)
  on conflict(player_hash,song,difficulty,chart_version) do update
  set name=excluded.name,score=excluded.score,accuracy=excluded.accuracy,max_combo=excluded.max_combo,updated_at=now()
  where excluded.score>pulse_keys_scores.score;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;
revoke execute on function public.pulse_keys_save_best(text,text,smallint,text,text,integer,numeric,integer) from public,anon,authenticated;
grant execute on function public.pulse_keys_save_best(text,text,smallint,text,text,integer,numeric,integer) to service_role;
