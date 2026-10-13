-- ---------------------------------------------------------------------------
-- BUSCA GLOBAL (Postgres Full Text Search) — roda com RLS do usuário
-- ---------------------------------------------------------------------------
create or replace function public.search_all(q text)
returns table (kind text, id uuid, title text, snippet text, href text, created_at timestamptz, rank real)
language sql stable security invoker set search_path = '' as $$
  select * from (
  with query as (select websearch_to_tsquery('portuguese', q) as tsq)
  select 'nota'::text as kind, n.id as id, coalesce(n.title, left(n.body, 80)) as title, left(n.body, 200) as snippet, '/brain#' || n.id as href, n.created_at as created_at,
         ts_rank(n.search, query.tsq) as rank
    from public.brain_notes n, query where n.search @@ query.tsq
  union all
  select 'projeto', p.id, p.name, coalesce(p.description, p.next_proof, ''), '/projetos/' || p.id, p.created_at,
         ts_rank(to_tsvector('portuguese', p.name || ' ' || coalesce(p.description,'') || ' ' || coalesce(p.objective,'') || ' ' || coalesce(p.blocker,'')), query.tsq)
    from public.projects p, query
   where to_tsvector('portuguese', p.name || ' ' || coalesce(p.description,'') || ' ' || coalesce(p.objective,'') || ' ' || coalesce(p.blocker,'')) @@ query.tsq
  union all
  select 'ideia', i.id, i.title, coalesce(i.description, ''), '/ideias#' || i.id, i.created_at,
         ts_rank(to_tsvector('portuguese', i.title || ' ' || coalesce(i.description,'')), query.tsq)
    from public.ideas i, query
   where to_tsvector('portuguese', i.title || ' ' || coalesce(i.description,'')) @@ query.tsq
  union all
  select 'decisão', d.id, d.title, coalesce(d.verdict_reason, d.motive, ''), '/decidir/' || d.id, d.created_at,
         ts_rank(to_tsvector('portuguese', d.title || ' ' || coalesce(d.motive,'') || ' ' || coalesce(d.evidence,'') || ' ' || coalesce(d.premortem,'')), query.tsq)
    from public.decisions d, query
   where to_tsvector('portuguese', d.title || ' ' || coalesce(d.motive,'') || ' ' || coalesce(d.evidence,'') || ' ' || coalesce(d.premortem,'')) @@ query.tsq
  union all
  select 'atualização', u.id, 'Atualização de projeto', left(u.body, 200), '/projetos/' || u.project_id, u.created_at,
         ts_rank(to_tsvector('portuguese', u.body), query.tsq)
    from public.project_updates u, query
   where to_tsvector('portuguese', u.body) @@ query.tsq
  union all
  select 'check-in', c.id, 'Check-in ' || to_char(c.day, 'DD/MM'), left(coalesce(c.raw_text, c.main_worry, ''), 200), '/hoje', c.created_at,
         ts_rank(to_tsvector('portuguese', coalesce(c.raw_text,'') || ' ' || coalesce(c.main_worry,'')), query.tsq)
    from public.daily_checkins c, query
   where to_tsvector('portuguese', coalesce(c.raw_text,'') || ' ' || coalesce(c.main_worry,'')) @@ query.tsq
  ) r
  order by r.rank desc, r.created_at desc
  limit 30
$$;


revoke execute on function public.search_all(text) from anon, public;
grant execute on function public.search_all(text) to authenticated;
