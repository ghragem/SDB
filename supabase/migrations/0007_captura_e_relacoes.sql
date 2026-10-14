-- Captura universal (falar/escrever → interpretar → confirmar → salvar) e relações entre registros.

-- Cada captura guarda o texto bruto, o que foi entendido e o que foi salvo onde.
-- Nada vira registro sem confirmação: a captura fica "pendente" até o usuário confirmar.
create table public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null default 'texto' check (source in ('audio','texto')),
  transcript text not null,
  audio_path text,
  interpreter text not null default 'regras' check (interpreter in ('regras','ia')),
  items jsonb not null default '[]'::jsonb,   -- sugestões (o que foi entendido)
  saved jsonb not null default '[]'::jsonb,   -- o que foi gravado: [{kind, table, id}]
  status text not null default 'pendente' check (status in ('pendente','confirmada','descartada','inbox')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Relação entre registros: erro → aprendizado → decisão; nota → projeto etc.
create table public.brain_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_kind text not null check (from_kind in ('nota','projeto','decisao','ideia','experimento','captura')),
  from_id uuid not null,
  to_kind text not null check (to_kind in ('nota','projeto','decisao','ideia','experimento','captura')),
  to_id uuid not null,
  relation text not null default 'relacionado'
    check (relation in ('relacionado','causou','levou_a','contradiz','confirma','aprendizado_de')),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, from_kind, from_id, to_kind, to_id)
);

do $$
declare t text;
begin
  foreach t in array array['captures','brain_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "dono lê" on public.%I for select to authenticated using ((select auth.uid()) = user_id)$p$, t);
    execute format($p$create policy "dono cria" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)$p$, t);
    execute format($p$create policy "dono edita" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
    execute format($p$create policy "dono apaga" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)$p$, t);
    execute format('create index %I on public.%I (user_id, created_at desc)', t || '_user_created_idx', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create index brain_links_from_idx on public.brain_links (from_kind, from_id);
create index brain_links_to_idx on public.brain_links (to_kind, to_id);
