import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, ChevronRight, Flame, Shield, Sun } from "lucide-react";
import { Listen } from "@/components/listen";
import { requireUser } from "@/lib/supabase/server";
import { aiStatus } from "@/lib/ai";
import { loadOperational } from "@/lib/operational";
import { fmtDateLong, greeting } from "@/lib/format";
import { DAY_STATE_LABEL, PROJECT_STATUS_LABEL, type DayState } from "@/lib/types";
import { Badge, Empty, LinkButton, cx } from "@/components/ui";
import { Submit } from "@/components/submit";
import { NextActionForm } from "@/components/next-action-form";
import { Checkin } from "./checkin";
import { logProgress } from "./actions";

export const metadata: Metadata = { title: "Hoje" };

const MODE_ICON: Record<DayState, typeof Sun> = { ataque: Flame, normal: Sun, sobrevivencia: Shield };
const MODE_RULE: Record<DayState, string> = {
  ataque: "Atacar a parte mais difícil do principal. Não começar outro.",
  normal: "Sessão padrão no principal.",
  sobrevivencia: "Escopo mínimo: nada de projeto novo nem decisão grande e irreversível. Uma ação pequena no principal e encerrar.",
};

// Hoje responde uma pergunta: o que eu faço agora? Modo do dia, prioridade #1, 3 ações, 1 alerta.
export default async function HojePage() {
  const { supabase } = await requireUser();
  const [op, profile] = await Promise.all([
    loadOperational(),
    supabase.from("profiles").select("display_name").maybeSingle(),
  ]);
  const name = profile.data?.display_name || "Gustavo";
  const top = op.ranked[0] ?? null;
  const ai = aiStatus();
  const latest = top
    ? (await supabase.from("project_updates").select("body, created_at").eq("project_id", top.project.id).eq("is_progress", true)
        .order("created_at", { ascending: false }).limit(1).maybeSingle()).data
    : null;
  const alert = op.alerts[0] ?? null;
  const ModeIcon = op.mode ? MODE_ICON[op.mode.state] : Sun;

  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight lg:text-[32px]">{greeting()}, {name}.</h1>
        <p className="mt-0.5 text-sm text-muted">{cap(fmtDateLong())}</p>
      </header>

      {/* Modo do dia (ou check-in, se ainda não foi feito) */}
      <section aria-label="Modo do dia" className="rounded-2xl border border-line bg-surface">
        {op.checkin && op.mode ? (
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                op.mode.state === "sobrevivencia" ? "bg-accent-soft text-accent" : op.mode.state === "ataque" ? "bg-ok/15 text-ok" : "bg-surface-2 text-ink")}>
                <ModeIcon size={18} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">Modo do dia: {DAY_STATE_LABEL[op.mode.state]}</p>
                <p className="text-[13px] text-muted">{op.mode.reason} {MODE_RULE[op.mode.state]}</p>
                {op.checkin.reading ? (
                  <details className="mt-1 text-[13px]">
                    <summary className="cursor-pointer text-muted">Leitura do check-in</summary>
                    <p className="mt-1 leading-relaxed">{op.checkin.reading}</p>
                    <div className="mt-1"><Listen text={op.checkin.reading} /></div>
                  </details>
                ) : null}
              </div>
            </div>
            <a href="#refazer-checkin" className="shrink-0 text-[13px] text-muted underline underline-offset-4">Refazer check-in</a>
          </div>
        ) : (
          <div className="p-4">
            <p className="font-semibold">Como você está chegando hoje?</p>
            <p className="mb-3 text-[13px] text-muted">Energia, foco e pressão definem o modo do dia. O resto da tela se ajusta a ele.</p>
            <Checkin transcriptionServer={ai.transcription} />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Prioridade #1 */}
        <section aria-label="Prioridade número 1" className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="label">Prioridade #1</p>
            {top ? <span className="text-xs tabular-nums text-muted">score {top.score}</span> : null}
          </div>
          {top ? (
            <>
              <div className="mt-1 flex items-start justify-between gap-3">
                <Link href={`/projetos/${top.project.id}`} className="text-[22px] font-semibold leading-tight hover:underline">{top.project.name}</Link>
                <Badge tone="accent">{PROJECT_STATUS_LABEL[top.project.status]}</Badge>
              </div>

              <details className="group mt-2 rounded-lg border border-line bg-bg">
                <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-[13px] text-muted">
                  Por que isso é prioridade? <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
                </summary>
                <div className="border-t border-line px-3 py-2 font-mono text-[13px]">
                  {top.factors.map((f) => (
                    <div key={f.label} className="flex justify-between gap-3 py-0.5">
                      <span className="min-w-0 text-muted">{f.label}</span>
                      <span className={cx("shrink-0 tabular-nums", f.points < 0 ? "text-accent" : f.points > 0 ? "text-ok" : "text-faint")}>{f.points > 0 ? `+${f.points}` : f.points}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex justify-between border-t border-line pt-1.5 font-semibold"><span>Score final</span><span className="tabular-nums">{top.score}</span></div>
                  <p className="mt-2 font-sans text-[12px] text-faint">
                    {op.ranked.length > 1 ? <>Na fila: {op.ranked.slice(1, 4).map((r) => `${r.project.name} (${r.score})`).join(" · ")}. </> : null}
                    <Link href="/projetos#como-calcula" className="underline underline-offset-2">Como o score é calculado</Link>
                  </p>
                </div>
              </details>

              <div id="proxima-acao" className="mt-4">
                <p className="text-[12px] text-muted">Próxima ação</p>
                {top.action.level === "ok" ? (
                  <p className="mt-0.5 text-[15.5px] font-medium">{top.project.next_action}</p>
                ) : (
                  <div className="mt-1 space-y-2">
                    <p className="text-sm text-accent">{top.action.reason}</p>
                    <NextActionForm projectId={top.project.id} current={top.project.next_action} />
                  </div>
                )}
              </div>

              {top.project.next_proof ? (
                <p className="mt-3 line-clamp-3 text-[13px] text-muted"><span className="text-faint">Próxima prova:</span> {top.project.next_proof}</p>
              ) : null}
              <p className="mt-1 text-[13px] text-muted">
                <span className="text-faint">Último avanço:</span>{" "}
                {latest ? <>{top.idleDays === 0 ? "hoje" : `há ${top.idleDays} ${top.idleDays === 1 ? "dia" : "dias"}`} · {latest.body}</> : <span className="text-accent">nenhum registrado</span>}
              </p>

              <form action={logProgress} className="mt-4 flex gap-2">
                <input type="hidden" name="project_id" value={top.project.id} />
                <input name="body" required placeholder="O que avançou? Fato, não intenção." aria-label="Registrar avanço"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 placeholder:text-faint focus:border-line-strong focus:outline-none" />
                <Submit pendingText="…">Registrar</Submit>
              </form>
            </>
          ) : (
            <div className="mt-2"><Empty title="Nenhum projeto ativo." action={<LinkButton href="/projetos/novo" variant="primary">Cadastrar projeto</LinkButton>}>Sem projeto ativo não há prioridade para calcular.</Empty></div>
          )}
        </section>

        <div className="min-w-0 space-y-5">
          {/* Próximas ações (máx. 3) */}
          <section aria-label="Próximas ações" className="rounded-2xl border border-line bg-surface">
            <p className="label px-4 pt-4">Próximas ações</p>
            <ol className="mt-2 divide-y divide-line">
              {op.actions.map((a, i) => (
                <li key={a.key}>
                  <Link href={a.href} className={cx("flex items-start gap-3 px-4 py-3 hover:bg-surface-2", a.done && "opacity-55")}>
                    <span className={cx("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-[13px] font-semibold",
                      a.done ? "bg-ok/15 text-ok" : i === 0 ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted")}>
                      {a.done ? <Check size={14} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx("block text-[14.5px] font-medium", a.done && "line-through")}>{a.label}</span>
                      {a.detail ? <span className="block text-[12.5px] text-muted">{a.detail}</span> : null}
                    </span>
                    <ArrowRight size={15} className="mt-1 shrink-0 text-faint" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* 1 alerta */}
          {alert ? (
            <section aria-label="Alerta" className="rounded-2xl border border-accent/40 bg-accent-soft p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0">
                  <p className="text-[15px] leading-snug">{alert.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
                    <Link href={alert.href} className="font-medium text-accent underline underline-offset-4">{alert.cta}</Link>
                    {op.alerts.length > 1 ? <Link href="/notificacoes" className="text-muted underline underline-offset-4">+{op.alerts.length - 1} {op.alerts.length === 2 ? "alerta" : "alertas"}</Link> : null}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <p className="px-1 text-[13px] text-muted">Nenhum alerta. Nada parado, vencendo ou disputando atenção com a prioridade.</p>
          )}
        </div>
      </div>

      {op.checkin ? (
        <details id="refazer-checkin" className="rounded-2xl border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm text-muted">Refazer check-in de hoje</summary>
          <div className="px-4 pb-4"><Checkin transcriptionServer={ai.transcription} /></div>
        </details>
      ) : null}
    </div>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
