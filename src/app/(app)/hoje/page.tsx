import { Listen } from "@/components/listen";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Play } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { aiStatus } from "@/lib/ai";
import { pickPriorityProject } from "@/lib/day";
import { LESSONS } from "@/lib/lessons";
import { daysSince, fmtDateLong, fmtDay, fmtMoney, greeting, todaySP } from "@/lib/format";
import { ACTIVE_STATUSES, DAY_STATE_LABEL, PROJECT_STATUS_LABEL, type Checkin as CheckinT, type Project, type SessionItem } from "@/lib/types";
import { Badge, Empty, LinkButton, SourceTag, cx } from "@/components/ui";
import { Submit } from "@/components/submit";
import { Avatar } from "@/components/shell";
import { Checkin } from "./checkin";
import { logProgress, toggleItem } from "./actions";

export const metadata: Metadata = { title: "Hoje" };

const KIND_LABEL: Record<SessionItem["kind"], string> = {
  projeto: "Projeto", estudo: "Estudo", falar: "Oratória", decisao: "Decisão", revisao: "Revisão", escrever: "Escrita", dinheiro: "Dinheiro",
};
// Cores dos números da sessão, na ordem do mockup.
const TILE = ["bg-accent/15 text-accent", "bg-warn/15 text-warn", "bg-info/15 text-info", "bg-violet/15 text-violet", "bg-ok/15 text-ok"];

const IDEA_STATUS: Record<string, string> = { capturada: "Capturada", analisando: "Em análise", validar: "Validar", teste: "Teste", promover: "Promover", descartada: "Descartada", arquivada: "Arquivada" };

export default async function HojePage() {
  const { supabase } = await requireUser();
  const today = todaySP();
  const monthStart = today.slice(0, 8) + "01";

  const [profile, checkins, session, projects, decisions, money, ideas, review] = await Promise.all([
    supabase.from("profiles").select("display_name").maybeSingle(),
    supabase.from("daily_checkins").select("*").eq("day", today).order("created_at", { ascending: false }).limit(1),
    supabase.from("daily_sessions").select("*").eq("day", today).order("created_at", { ascending: false }).limit(1),
    supabase.from("projects").select("*").order("priority").order("created_at"),
    supabase.from("decisions").select("id, title, review_at, status, verdict, created_at").in("status", ["aberta", "decidida"]).order("created_at", { ascending: false }).limit(4),
    supabase.from("finance_transactions").select("type, amount").gte("occurred_on", monthStart),
    supabase.from("ideas").select("id, title, status, created_at").order("created_at", { ascending: false }).limit(4),
    supabase.from("daily_reviews").select("id").eq("day", today).maybeSingle(),
  ]);

  const name = profile.data?.display_name || "Gustavo";
  const checkin = (checkins.data?.[0] ?? null) as CheckinT | null;
  const s = session.data?.[0] ?? null;
  const items = (s?.items ?? []) as SessionItem[];
  const reading: string | null = checkin?.reading ?? (s?.metadata as { reading?: string } | null)?.reading ?? null;
  const readingSource = checkin?.reading_source ?? (s?.source as "ia" | "regras" | undefined) ?? null;
  const allProjects = (projects.data ?? []) as Project[];
  const active = allProjects.filter((p) => ACTIVE_STATUSES.includes(p.status));
  const priority = pickPriorityProject(allProjects);
  const lastUpdate = priority
    ? (await supabase.from("project_updates").select("body, created_at").eq("project_id", priority.id).eq("is_progress", true)
        .order("created_at", { ascending: false }).limit(1).maybeSingle()).data
    : null;
  const tx = money.data ?? [];
  const sum = (t: string) => tx.filter((x) => x.type === t).reduce((a, x) => a + Number(x.amount), 0);
  const result = sum("receita") - sum("despesa") - sum("investimento");
  const ai = aiStatus();
  const doneCount = items.filter((i) => i.done).length;
  const studyItem = items.find((i) => i.kind === "estudo");
  const lessonSlug = studyItem?.href?.split("/aprender/")[1] ?? null;
  const lessons = [...LESSONS].sort((a, b) => (a.slug === lessonSlug ? -1 : b.slug === lessonSlug ? 1 : 0)).slice(0, 3);

  return (
    <div className="space-y-6 lg:space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight lg:text-[32px]">{greeting()}, {name}.</h1>
          <p className="mt-0.5 text-sm text-muted">{cap(fmtDateLong())}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:hidden"><Avatar name={name} size={40} /></div>
        {checkin?.day_state ? (
          <div className="hidden shrink-0 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 lg:flex">
            <span className="text-sm">Modo do dia: <b className={checkin.day_state === "sobrevivencia" ? "text-accent" : undefined}>{DAY_STATE_LABEL[checkin.day_state]}</b></span>
          </div>
        ) : null}
      </header>

      {/* Linha 1: check-in · leitura · resumo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <Panel id="checkin" title={checkin ? "Check-in do dia" : "Como você está chegando hoje?"}
          sub={checkin ? `Feito às ${new Date(checkin.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}. Pode refazer.` : "Fale ou escreva o que está na sua cabeça."}>
          <Checkin transcriptionServer={ai.transcription} />
        </Panel>

        <Panel title="Leitura do dia">
          {reading ? (
            <>
              <p className="text-[15.5px] leading-relaxed">{reading}</p>
              <div className="mt-3 flex items-center justify-between gap-2"><SourceTag source={readingSource} /><Listen text={reading} /></div>
            </>
          ) : (
            <p className="text-sm text-muted">Sai do seu check-in e dos seus projetos. Faça o check-in para ver a leitura de hoje.</p>
          )}
        </Panel>

        <Panel title="Resumo rápido" className="hidden lg:block">
          {checkin ? (
            <div className="grid grid-cols-3 gap-2">
              <Mini label="Energia" value={checkin.energy ? `${checkin.energy}/5` : "—"} />
              <Mini label="Foco" value={checkin.focus ? `${checkin.focus}/5` : "—"} />
              <Mini label="Pressão" value={checkin.pressure ? `${checkin.pressure}/5` : "—"} />
              <Mini className="col-span-3" label="Principal preocupação" value={checkin.main_worry || "Não registrada"} />
              <Mini className="col-span-3" label="Prioridade" value={priority?.name ?? "Sem projeto ativo"} />
            </div>
          ) : (
            <p className="text-sm text-muted">Sem check-in hoje. O check-in rápido registra energia, foco e pressão.</p>
          )}
        </Panel>
      </div>

      {/* Linha 2: sessão · prioridade · dinheiro */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <Panel title="O que importa hoje" action={items.length ? <span className="text-xs tabular-nums text-muted">{doneCount}/{items.length} feitos</span> : null} flush>
          {items.length ? (
            <ol className="divide-y divide-line">
              {items.map((it, i) => (
                <li key={i} className={cx("flex items-center gap-3 px-4 py-3", it.done && "opacity-55")}>
                  <form action={toggleItem}>
                    <input type="hidden" name="session_id" value={s!.id} />
                    <input type="hidden" name="index" value={i} />
                    <button aria-label={it.done ? `Desmarcar ${it.title}` : `Marcar ${it.title} como feito`}
                      className={cx("grid h-10 w-10 place-items-center rounded-lg font-mono text-sm font-semibold", it.done ? "bg-ok/15 text-ok" : TILE[i % TILE.length])}>
                      {it.done ? <Check size={16} strokeWidth={3} /> : String(i + 1).padStart(2, "0")}
                    </button>
                  </form>
                  <Link href={it.href || "/hoje"} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className={cx("block truncate font-medium", it.done && "line-through")}>{it.kind === "projeto" ? it.title : KIND_LABEL[it.kind] ?? it.kind}</span>
                      <span className="block truncate text-[13px] text-muted">{it.kind === "projeto" || it.title === KIND_LABEL[it.kind] ? it.detail : it.title}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">{it.minutes} min</span>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line-strong text-ink"><Play size={11} fill="currentColor" /></span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="p-4"><Empty title="Ainda não há sessão para hoje.">Faça o check-in. A sessão sai do que você disser e dos seus projetos.</Empty></div>
          )}
        </Panel>

        <Panel title="Projeto prioritário" action={priority ? <Link href={`/projetos/${priority.id}`} className="text-[13px] text-muted hover:text-ink">Ver projeto</Link> : null}>
          {priority ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/projetos/${priority.id}`} className="text-lg font-semibold hover:underline">{priority.name}</Link>
                  {priority.description ? <p className="truncate text-[13px] text-muted">{priority.description}</p> : null}
                </div>
                <Badge tone="accent">{PROJECT_STATUS_LABEL[priority.status]}</Badge>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="text-[12px] text-muted">Próxima prova</dt><dd className="mt-0.5">{priority.next_proof ?? <span className="text-accent">Não definida</span>}</dd></div>
                <div><dt className="text-[12px] text-accent">Último avanço</dt><dd className="mt-0.5"><IdleText days={daysSince(priority.last_progress_at)} />{lastUpdate ? <span className="text-muted"> · {lastUpdate.body}</span> : null}</dd></div>
                <div><dt className="text-[12px] text-accent">Bloqueio atual</dt><dd className="mt-0.5">{priority.blocker ?? <span className="text-muted">Nenhum registrado</span>}</dd></div>
              </dl>
              <form action={logProgress} className="mt-4 flex gap-2">
                <input type="hidden" name="project_id" value={priority.id} />
                <input name="body" required placeholder="O que avançou? Fato, não intenção." aria-label="Registrar avanço"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 placeholder:text-faint focus:border-line-strong focus:outline-none" />
                <Submit pendingText="…">Registrar</Submit>
              </form>
            </div>
          ) : (
            <Empty title="Nenhum projeto ativo." action={<LinkButton href="/projetos/novo" variant="primary">Cadastrar projeto</LinkButton>}>Sem projeto ativo não há prioridade para calcular.</Empty>
          )}
        </Panel>

        <Panel title="Finanças do mês" action={<Link href="/dinheiro" className="text-[13px] text-muted hover:text-ink">Ver detalhes</Link>}>
          {tx.length ? (
            <div>
              <p className={cx("text-[30px] font-semibold tabular-nums tracking-tight", result < 0 && "text-accent")}>{fmtMoney(result)}</p>
              <p className="text-[13px] text-muted">Resultado do mês</p>
              <div className="mt-4 space-y-2 text-sm">
                <MoneyRow dot="bg-ok" label="Entradas" value={fmtMoney(sum("receita"))} />
                <MoneyRow dot="bg-accent" label="Saídas" value={fmtMoney(sum("despesa"))} />
                <MoneyRow dot="bg-info" label="Investimentos" value={fmtMoney(sum("investimento"))} />
              </div>
            </div>
          ) : (
            <Empty title="Nenhum lançamento este mês." action={<LinkButton href="/dinheiro" size="sm">Registrar</LinkButton>}>Sem lançamento não há número para mostrar.</Empty>
          )}
        </Panel>
      </div>

      {/* Linha 3: projetos · aprender · ideias · decisões */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel title="Projetos" action={<Link href="/projetos" className="text-[13px] text-muted hover:text-ink">Ver todos</Link>} flush>
          {active.length ? (
            <ul className="divide-y divide-line">
              {active.slice(0, 4).map((p) => {
                const d = daysSince(p.last_progress_at);
                return (
                  <li key={p.id}>
                    <Link href={`/projetos/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{p.name}</span><span className="text-xs text-muted">{PROJECT_STATUS_LABEL[p.status]}</span></span>
                      <span className={cx("shrink-0 text-xs tabular-nums", d === null || d >= 5 ? "text-accent" : "text-muted")}>{d === null ? "sem avanço" : d === 0 ? "hoje" : `${d}d parado`}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <p className="px-4 pb-4 text-sm text-muted">Nenhum projeto ativo.</p>}
        </Panel>

        <Panel title="Aprender hoje" action={<Link href="/aprender" className="text-[13px] text-muted hover:text-ink">Ver todos</Link>} flush>
          <ul className="divide-y divide-line">
            {lessons.map((l) => (
              <li key={l.slug}>
                <Link href={`/aprender/${l.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{l.title}</span>
                    <span className="text-xs text-muted">{l.area} · {l.minutes} min{l.slug === lessonSlug ? " · recomendada hoje" : ""}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Últimas ideias" action={<Link href="/ideias" className="text-[13px] text-muted hover:text-ink">Ver todas</Link>} flush>
          {ideas.data?.length ? (
            <ul className="divide-y divide-line">
              {ideas.data.map((i) => (
                <li key={i.id}>
                  <Link href="/ideias" className="block px-4 py-2.5 hover:bg-surface-2">
                    <span className="block truncate text-sm font-medium">{i.title}</span>
                    <span className="text-xs text-muted">{IDEA_STATUS[i.status] ?? i.status} · {fmtDay(i.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 pb-4 text-sm text-muted">Nenhuma ideia capturada.</p>}
        </Panel>

        <Panel title="Últimas decisões" action={<Link href="/decidir" className="text-[13px] text-muted hover:text-ink">Ver todas</Link>} flush>
          {decisions.data?.length ? (
            <ul className="divide-y divide-line">
              {decisions.data.map((d) => (
                <li key={d.id}>
                  <Link href={`/decidir/${d.id}`} className="block px-4 py-2.5 hover:bg-surface-2">
                    <span className="block truncate text-sm font-medium">{d.title}</span>
                    <span className={cx("text-xs", d.review_at && d.review_at <= today ? "text-accent" : "text-muted")}>
                      {d.status === "aberta" ? "Sem veredito" : d.review_at ? `Revisar em ${fmtDay(d.review_at)}` : "Decidida"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 pb-4"><LinkButton href="/decidir/nova" size="sm">Registrar decisão</LinkButton></div>
          )}
        </Panel>
      </div>

      <div className="pt-2">
        {review.data ? (
          <p className="text-sm text-muted">Revisão de hoje registrada. <Link href="/review" className="underline underline-offset-4">Ver</Link></p>
        ) : (
          <LinkButton href="/review" variant="secondary" className="w-full">Finalizar sessão · revisão de 2 minutos <ArrowRight size={16} /></LinkButton>
        )}
      </div>
    </div>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Panel({ id, title, sub, action, children, className, flush }: {
  id?: string; title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section id={id} className={cx("min-w-0 rounded-2xl border border-line bg-surface", className)} aria-label={title}>
      <div className={cx("flex items-start justify-between gap-3 px-4 pt-4", flush ? "pb-2" : "pb-3")}>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          {sub ? <p className="mt-0.5 text-[13px] text-muted">{sub}</p> : null}
        </div>
        {action}
      </div>
      <div className={flush ? undefined : "px-4 pb-4"}>{children}</div>
    </section>
  );
}

function Mini({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cx("rounded-lg border border-line bg-bg px-3 py-2", className)}>
      <p className="text-[11px] text-muted">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function MoneyRow({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted"><span className={cx("h-2 w-2 rounded-sm", dot)} />{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function IdleText({ days }: { days: number | null }) {
  if (days === null) return <span className="text-accent">Nenhum avanço registrado</span>;
  if (days === 0) return <span>Hoje</span>;
  return <span className={days >= 5 ? "text-accent" : undefined}>Há {days} {days === 1 ? "dia" : "dias"}</span>;
}
