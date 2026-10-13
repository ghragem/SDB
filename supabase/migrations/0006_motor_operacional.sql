-- Motor operacional: próxima ação e prazo por projeto, revisão diária com decisão pendente
-- e primeira ação de amanhã, gasto real por experimento.

alter table public.projects
  add column next_action text,          -- passo concreto e executável (≠ próxima prova, que é o marco)
  add column next_action_at timestamptz,
  add column deadline date;

alter table public.daily_reviews
  add column pending_decision text;     -- "qual decisão ficou pendente?"
comment on column public.daily_reviews.tomorrow is 'Primeira ação de amanhã';

-- Gasto acumulado do experimento (soma de experiment_results.spent) para a fila de risco.
create or replace view public.experiment_spend with (security_invoker = true) as
  select e.id as experiment_id, e.user_id, coalesce(sum(r.spent), 0)::numeric as spent, max(r.created_at) as last_result_at
    from public.experiments e
    left join public.experiment_results r on r.experiment_id = e.id
   group by e.id, e.user_id;

grant select on public.experiment_spend to authenticated;
revoke all on public.experiment_spend from anon;
