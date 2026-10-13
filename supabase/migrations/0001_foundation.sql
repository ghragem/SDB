-- Saindo do Bairro — schema inicial (V1)
-- Todas as tabelas: id, user_id, created_at, updated_at, status, metadata, RLS por dono.

create extension if not exists pgcrypto;

-- updated_at automático
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- PERFIL E PREFERÊNCIAS
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  city text,
  goals text,                       -- onboarding 1: o que quer melhorar
  skills_focus text[] not null default '{}',   -- onboarding 3
  recurring_problems text,          -- onboarding 4
  onboarded_at timestamptz,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  reality_level text not null default 'muito_direto'
    check (reality_level in ('suave','direto','muito_direto')),
  ai_provider text check (ai_provider in ('anthropic','openai')),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cria profile + preferences quando um usuário se cadastra
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, user_id, display_name)
    values (new.id, new.id, coalesce(new.raw_user_meta_data->>'display_name', null));
  insert into public.preferences (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- PROJETOS
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'construcao'
    check (status in ('ideia','planejamento','construcao','validacao','operando','escalando','pausado','encerrado')),
  priority smallint not null default 2 check (priority between 1 and 3), -- 1 = alta
  objective text,
  next_proof text,          -- próxima prova concreta
  next_delivery text,
  blocker text,
  hypotheses text,
  risks text,
  last_progress_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null default 'avanco' check (kind in ('avanco','bloqueio','decisao','nota','validacao')),
  body text not null,
  is_progress boolean not null default true,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Avanço registrado atualiza last_progress_at do projeto
create or replace function public.touch_project_progress() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_progress then
    update public.projects set last_progress_at = new.created_at where id = new.project_id;
  end if;
  return new;
end $$;

create trigger project_update_progress
  after insert on public.project_updates
  for each row execute function public.touch_project_progress();

create table public.project_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  value numeric,
  unit text,
  measured_at date not null default current_date,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- IDEIAS (Idea Lab)
-- ---------------------------------------------------------------------------
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'capturada'
    check (status in ('capturada','analisando','validar','teste','promover','descartada','arquivada')),
  -- Regra anti-dispersão (seção 29)
  why_now text,
  project_losing_time text,
  evidence text,
  test_cost text,
  time_to_learn text,
  reversible text,
  opportunity_or_novelty text check (opportunity_or_novelty in ('oportunidade','novidade','nao_sei')),
  promoted_project_id uuid references public.projects(id) on delete set null,
  discard_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DECISÕES
-- ---------------------------------------------------------------------------
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  objective text,
  motive text,
  amount numeric,
  upside text,
  downside text,
  max_loss numeric,
  evidence text,
  assumptions text,
  reversibility text check (reversibility in ('reversivel','parcial','irreversivel')),
  deadline date,
  alternatives text,
  opportunity_cost text,
  premortem text,
  verdict text check (verdict in ('fazer','testar_pequeno','esperar','nao_fazer','faltam_dados')),
  verdict_reason text,
  confidence text check (confidence in ('alta','media','baixa')),
  against_recommendation boolean not null default false,
  review_at date,
  status text not null default 'aberta' check (status in ('aberta','decidida','revisada','cancelada')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decision_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  decision_id uuid not null references public.decisions(id) on delete cascade,
  what_happened text not null,
  expected_vs_real text,
  lesson text,
  outcome text check (outcome in ('acertou','errou','parcial','cedo_demais')),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- EXPERIMENTOS
-- ---------------------------------------------------------------------------
create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  decision_id uuid references public.decisions(id) on delete set null,
  hypothesis text not null,
  max_amount numeric,
  metric text,
  deadline date,
  stop_condition text,
  scale_condition text,
  result text,
  learning text,
  status text not null default 'rodando' check (status in ('planejado','rodando','validado','rejeitado','inconclusivo')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.experiment_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  spent numeric,
  metric_value numeric,
  note text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- BRAIN + INBOX
-- ---------------------------------------------------------------------------
create table public.brain_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'nota'
    check (kind in ('nota','insight','erro','aprendizado','decisao','ideia','pessoa','referencia','link','conversa','pesquisa','hipotese','regra')),
  title text,
  body text not null,
  url text,
  project_id uuid references public.projects(id) on delete set null,
  epistemic text check (epistemic in ('fato','analise','hipotese','opiniao')),
  source text,
  search tsvector generated always as (
    to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(body,''))
  ) stored,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brain_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  url text,
  author text,
  kind text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'nota'
    check (kind in ('ideia','nota','audio','link','despesa','receita','erro','aprendizado','decisao','oportunidade','tarefa','foto','print','conversa')),
  body text not null,
  amount numeric,
  status text not null default 'pendente' check (status in ('pendente','classificado','descartado')),
  routed_table text,
  routed_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Regras que aprendemos (Manual de Realidade, seções 154–159)
create table public.reality_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rule text not null,
  detail text,
  origin text not null default 'precarregada' check (origin in ('precarregada','experiencia')),
  position smallint not null default 0,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DIA: CHECK-IN, SESSÃO, REVISÕES
-- ---------------------------------------------------------------------------
create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default current_date,
  mode text not null check (mode in ('falar','escrever','rapido')),
  energy smallint check (energy between 1 and 5),
  focus smallint check (focus between 1 and 5),
  pressure smallint check (pressure between 1 and 5),
  main_worry text,
  raw_text text,          -- texto digitado ou transcrição confirmada
  audio_path text,        -- Storage: audio/<user_id>/<arquivo>
  day_state text check (day_state in ('ataque','normal','sobrevivencia')),
  reading text,           -- leitura do dia
  reading_source text check (reading_source in ('ia','regras')),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default current_date,
  checkin_id uuid references public.daily_checkins(id) on delete set null,
  day_state text check (day_state in ('ataque','normal','sobrevivencia')),
  -- items: [{kind, title, detail, minutes, ref_table, ref_id, done}]
  items jsonb not null default '[]'::jsonb,
  source text check (source in ('ia','regras')),
  status text not null default 'aberta' check (status in ('aberta','encerrada')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default current_date,
  advanced text,
  wasted text,
  tomorrow text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  keep_doing text,
  stop_doing text,
  start_doing text,
  week_priority text,
  snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ---------------------------------------------------------------------------
-- DINHEIRO
-- ---------------------------------------------------------------------------
create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occurred_on date not null default current_date,
  type text not null check (type in ('receita','despesa','investimento')),
  amount numeric(14,2) not null check (amount >= 0),
  category text not null default 'outros'
    check (category in ('vendas','servicos','salario','ads','gateway','ferramentas','reembolso','estoque','faculdade','lazer','compras','moradia','transporte','alimentacao','patrimonio','outros')),
  project_id uuid references public.projects(id) on delete set null,
  description text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- NOTIFICAÇÕES E IA
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  body text not null,
  href text,
  read_at timestamptz,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null,
  model text,
  task text not null,
  input_summary text,
  output text,
  context_keys text[] not null default '{}',
  -- Calibração (seção 152): a recomendação foi boa?
  rating text check (rating in ('boa','ruim','neutra')),
  status text not null default 'ok',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- BACKLOG (P1/P2): tabelas já criadas, colunas específicas em `data`
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'lessons','lesson_progress','study_sessions','subjects','college_tasks',
    'skills','skill_scores','speech_sessions','writing_sessions','sales_sessions',
    'copy_sessions','business_financials','opportunities','properties',
    'people_references','content_recommendations','content_consumption',
    'integrations','import_jobs'
  ] loop
    execute format($f$
      create table public.%I (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
        title text,
        data jsonb not null default '{}'::jsonb,
        status text not null default 'active',
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )$f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS, políticas de dono, índices e triggers para todas as tabelas
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'user_id'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "dono lê" on public.%I for select to authenticated using ((select auth.uid()) = user_id)$p$, t);
    execute format($p$create policy "dono cria" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)$p$, t);
    execute format($p$create policy "dono edita" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
    execute format($p$create policy "dono apaga" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)$p$, t);
    if t not in ('profiles','preferences') then
      execute format('create index %I on public.%I (user_id, created_at desc)', t || '_user_created_idx', t);
    end if;
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Índices de FK e busca
create index project_updates_project_idx on public.project_updates (project_id, created_at desc);
create index project_metrics_project_idx on public.project_metrics (project_id);
create index ideas_promoted_idx on public.ideas (promoted_project_id);
create index decisions_project_idx on public.decisions (project_id);
create index decisions_review_idx on public.decisions (user_id, review_at) where status <> 'revisada';
create index decision_reviews_decision_idx on public.decision_reviews (decision_id);
create index experiments_project_idx on public.experiments (project_id);
create index experiments_decision_idx on public.experiments (decision_id);
create index experiment_results_exp_idx on public.experiment_results (experiment_id);
create index brain_notes_project_idx on public.brain_notes (project_id);
create index brain_notes_search_idx on public.brain_notes using gin (search);
create index daily_checkins_day_idx on public.daily_checkins (user_id, day desc);
create index daily_sessions_day_idx on public.daily_sessions (user_id, day desc);
create index daily_sessions_checkin_idx on public.daily_sessions (checkin_id);
create index finance_project_idx on public.finance_transactions (project_id);
create index finance_day_idx on public.finance_transactions (user_id, occurred_on desc);

-- ---------------------------------------------------------------------------
-- STORAGE: áudios privados por usuário
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', false, 26214400, array['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-m4a','audio/aac'])
on conflict (id) do nothing;

create policy "audio: dono lê" on storage.objects for select to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "audio: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "audio: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
