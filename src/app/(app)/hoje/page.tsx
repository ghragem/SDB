import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { aiStatus } from "@/lib/ai";
import { pickPriorityProject } from "@/lib/day";
import { daysSince, fmtDateLong, fmtMoney, greeting, todaySP } from "@/lib/format";
import { DAY_STATE_LABEL, PROJECT_STATUS_LABEL, type Checkin as CheckinT, type Project, type SessionItem } from "@/lib/types";
import { Badge, Card, Empty, LinkButton, Section, SourceTag, cx } from "@/components/ui";
import { Submit } from "@/components/submit";
import { Checkin } from "./checkin";
import { logProgress, toggleItem } from "./actions";

export const metadata: Metadata = { title: "Hoje" };

const KIND_LABEL: Record<SessionItem["kind"], string> = {
  projeto: "Projeto", estudo: "Estudo", falar: "Oratória", decisao: "Decisão", revisao: "Revisão", escrever: "Escrita", dinheiro: "Dinheiro",
};

export default async function HojePage() {
  const { supabase } = await requireUser();
  const today = todaySP();
  const monthStart = today.slice(0, 8) + "01";

  const [profile, checkins, session, projects, decisions, money, ideas, review] = await Promise.all([
    supabase.from("profiles").select("display_name").maybeSingle(),
    supabase.from("daily_checkins").select("*").eq("day", today).order("created_at", { ascending: false }).limit(1),
    supabase.from("daily_sessions").select("*").eq("day", today).order("created_at", { ascending: false }).limit(1),
    supabase.from("projects").select("*").order("priority").order("created_at"),
    supabase.from("decisions").select("id, title, review_at, status, verdict").in("status", ["aberta", "decidida"]).order("review_at", { ascending: true, nullsFirst: false }).limit(3),
    supabase.from("finance_transactions").select("type, amount").gte("occurred_on", monthStart),
    supabase.from("ideas").select("id", { count: "exact", head: true }).eq("status", "capturada"),
    supabase.from("daily_reviews").select("id").eq("day", today).maybeSingle(),
  ]);

  const name = profile.data?.display_name || "Gustavo";
  const checkin = (checkins.data?.[0] ?? null) as CheckinT | null;
  const s = session.data?.[0] ?? null;
  const items = (s?.items ?? []) as SessionItem[];
  const reading: string | null = checkin?.reading ?? (s?.metadata as { reading?: string } | null)?.reading ?? null;
  const readingSource = checkin?.reading_source ?? (s?.source as "ia" | "regras" | undefined) ?? null;
  const allProjects = (projects.data ?? []) as Project[];
  const priority = pickPriorityProject(allProjects);
  const tx = money.data ?? [];
  const sum = (t: string) => tx.filter((x) => x.type === t).reduce((a, x) => a + Number(x.amount), 0);
  const ai = aiStatus();
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="space-y-9">
      <header>
        <p className="text-sm capitalize text-muted">{fmtDateLong()}</p>
        <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight">{greeting()}, {name}.</h1>
      </header>

      {/* PULSO */}
      <Section title="Pulso" action={checkin?.day_state ? <Badge tone={checkin.day_state === "sobrevivencia" ? "accent" : "neutral"}>{DAY_STATE_LABEL[checkin.day_state]}</Badge> : null}>
        {checkin ? (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-[10px] border border-line bg-surface px-4 py-3 text-sm">
              <span>
                Check-in feito às {new Date(checkin.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                {checkin.energy ? <span className="text-muted"> · E{checkin.energy} F{checkin.focus} P{checkin.pressure}</span> : null}
              </span>
              <span className="text-muted group-open:hidden">Refazer</span>
            </summary>
            <div className="mt-3"><Checkin transcriptionServer={ai.transcription} /></div>
          </details>
        ) : (
          <Card className="p-4">
            <p className="mb-3 font-medium">Como você está chegando hoje?</p>
            <Checkin transcriptionServer={ai.transcription} />
          </Card>
        )}
      </Section>

      {/* LEITURA */}
      {reading ? (
        <Section title="Leitura do dia">
          <div className="border-l-2 border-accent pl-4">
            <p className="text-[17px] leading-relaxed">{reading}</p>
            <div className="mt-2"><SourceTag source={readingSource} /></div>
          </div>
        </Section>
      ) : null}

      {/* O QUE IMPORTA HOJE */}
      <Section title="O que importa hoje" action={items.length ? <span className="text-xs tabular-nums text-muted">{doneCount}/{items.length}</span> : null}>
        {items.length ? (
          <ol className="space-y-2">
            {items.map((it, i) => (
              <li key={i}>
                <Card className={cx("flex items-stretch", it.done && "opacity-60")}>
                  <form action={toggleItem} className="flex">
                    <input type="hidden" name="session_id" value={s!.id} />
                    <input type="hidden" name="index" value={i} />
                    <button aria-label={it.done ? "Desmarcar" : "Marcar como feito"} className="grid w-12 place-items-center border-r border-line">
                      <span className={cx("grid h-5 w-5 place-items-center rounded-md border", it.done ? "border-ink bg-ink text-bg" : "border-line-strong")}>
                        {it.done ? <Check size={13} strokeWidth={3} /> : null}
                      </span>
                    </button>
                  </form>
                  <Link href={it.href || "#"} className="flex min-w-0 flex-1 items-start gap-3 p-3.5">
                    <span className="mt-0.5 font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{KIND_LABEL[it.kind] ?? it.kind}</span>
                        <span className="text-xs tabular-nums text-muted">{it.minutes} min</span>
                      </span>
                      <span className={cx("mt-0.5 block font-medium", it.done && "line-through")}>{it.title}</span>
                      <span className="mt-0.5 block text-sm text-muted">{it.detail}</span>
                    </span>
                  </Link>
                </Card>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="Ainda não há sessão para hoje.">Faça o check-in acima. A sessão sai do que você disser e dos seus projetos.</Empty>
        )}
      </Section>

      {/* PROJETO PRIORITÁRIO */}
      <Section title="Projeto prioritário" action={<Link href="/projetos" className="text-sm text-muted hover:text-ink">Todos</Link>}>
        {priority ? (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/projetos/${priority.id}`} className="text-lg font-semibold hover:underline">{priority.name}</Link>
                <p className="text-sm text-muted">{PROJECT_STATUS_LABEL[priority.status]}</p>
              </div>
              <IdleBadge days={daysSince(priority.last_progress_at)} />
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="label">Próxima prova</dt><dd className="mt-1">{priority.next_proof ?? <span className="text-accent">Não definida</span>}</dd></div>
              <div><dt className="label">Bloqueio</dt><dd className="mt-1">{priority.blocker ?? <span className="text-muted">Nenhum registrado</span>}</dd></div>
            </dl>
            <form action={logProgress} className="mt-4 flex gap-2">
              <input type="hidden" name="project_id" value={priority.id} />
              <input name="body" required placeholder="O que avançou? (fato, não intenção)" aria-label="Registrar avanço"
                className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 placeholder:text-faint focus:border-line-strong focus:outline-none" />
              <Submit pendingText="…">Registrar</Submit>
            </form>
          </Card>
        ) : (
          <Empty title="Nenhum projeto ativo." action={<LinkButton href="/projetos/novo" variant="primary">Cadastrar projeto</LinkButton>}>Sem projeto ativo não há prioridade para calcular.</Empty>
        )}
      </Section>

      <div className="grid gap-9 sm:grid-cols-2 sm:gap-4">
        {/* DECISÃO */}
        <Section title="Próxima decisão">
          {decisions.data?.length ? (
            <Card className="divide-y divide-line">
              {decisions.data.map((d) => (
                <Link key={d.id} href={`/decidir/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                  <span className="truncate">{d.title}</span>
                  <span className={cx("shrink-0 text-xs", d.review_at && d.review_at <= today ? "text-accent" : "text-muted")}>
                    {d.status === "aberta" ? "sem veredito" : d.review_at ? `revisar ${d.review_at.slice(8, 10)}/${d.review_at.slice(5, 7)}` : "sem revisão"}
                  </span>
                </Link>
              ))}
            </Card>
          ) : (
            <Empty title="Nenhuma decisão registrada." action={<LinkButton href="/decidir/nova" size="sm">Registrar decisão</LinkButton>} />
          )}
        </Section>

        {/* DINHEIRO */}
        <Section title="Dinheiro no mês" action={<Link href="/dinheiro" className="text-sm text-muted hover:text-ink">Abrir</Link>}>
          {tx.length ? (
            <Card className="grid grid-cols-3 divide-x divide-line">
              <Stat label="Entrou" value={fmtMoney(sum("receita"))} />
              <Stat label="Saiu" value={fmtMoney(sum("despesa") + sum("investimento"))} />
              <Stat label="Resultado" value={fmtMoney(sum("receita") - sum("despesa") - sum("investimento"))} tone={sum("receita") - sum("despesa") - sum("investimento") < 0 ? "accent" : undefined} />
            </Card>
          ) : (
            <Empty title="Nenhum lançamento este mês." action={<LinkButton href="/dinheiro" size="sm">Registrar</LinkButton>} />
          )}
        </Section>
      </div>

      {(ideas.count ?? 0) > 0 ? (
        <Link href="/ideias" className="flex items-center justify-between rounded-[10px] border border-line px-4 py-3 text-sm hover:bg-surface">
          <span>{ideas.count} {ideas.count === 1 ? "ideia capturada esperando" : "ideias capturadas esperando"} análise. Nenhuma vira projeto sem passar pela regra anti-dispersão.</span>
          <ArrowUpRight size={16} className="shrink-0 text-muted" />
        </Link>
      ) : null}

      {/* FINALIZAR */}
      <div className="border-t border-line pt-6">
        {review.data ? (
          <p className="text-sm text-muted">Revisão de hoje registrada. <Link href="/review" className="underline underline-offset-4">Ver</Link></p>
        ) : (
          <LinkButton href="/review" variant="secondary" className="w-full">Finalizar sessão · revisão de 2 minutos</LinkButton>
        )}
      </div>
    </div>
  );
}

function IdleBadge({ days }: { days: number | null }) {
  if (days === null) return <Badge tone="warn">sem avanço registrado</Badge>;
  return <Badge tone={days >= 5 ? "accent" : "neutral"}>{days === 0 ? "avançou hoje" : `${days} ${days === 1 ? "dia" : "dias"} sem avanço`}</Badge>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <div className="px-3 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className={cx("mt-1 truncate text-[15px] font-semibold tabular-nums", tone === "accent" && "text-accent")}>{value}</p>
    </div>
  );
}
