"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, ErrorNote, Input, Select, Textarea, cx } from "@/components/ui";
import { PROJECT_STATUS_LABEL } from "@/lib/types";
import { finishOnboarding, type OnboardingState } from "./actions";

const GOAL_CHIPS = ["Terminar o que começo", "Decidir melhor com dinheiro", "Falar melhor", "Escrever melhor", "Vender melhor", "Estudar com consistência", "Gestão e números"];
const SKILLS = ["Oratória", "Escrita", "Português", "Copy", "Vendas", "Negociação", "Gestão", "Finanças", "Marketing", "Estratégia", "Execução", "Tecnologia", "Repertório", "Raciocínio crítico"];
const PROBLEMS = ["Começo coisa nova antes de terminar", "Confundo faturamento com lucro", "Decido com medo de perder dinheiro", "Consumo conteúdo e não aplico", "Escalo sem hipótese", "Invisto sem limite definido", "Trabalho muito sem resultado"];
const PROJECT_SUGGESTIONS = ["AutoFlow", "R4DAR", "Coach de Bolso", "Refrimax"];

type P = { name: string; status: string; proof: string };

export function OnboardingFlow({ name }: { name: string | null }) {
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState("");
  const [projects, setProjects] = useState<P[]>([{ name: "", status: "construcao", proof: "" }]);
  const [skills, setSkills] = useState<string[]>([]);
  const [problems, setProblems] = useState("");
  const [reality, setReality] = useState("muito_direto");
  const [state, action, pending] = useActionState<OnboardingState, FormData>(finishOnboarding, {});

  const appendLine = (text: string, value: string, set: (v: string) => void) =>
    set(value.includes(text) ? value : (value ? value.trimEnd() + "\n" : "") + text);
  const updateProject = (i: number, patch: Partial<P>) => setProjects((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const steps = [
    {
      title: "O que você quer melhorar?",
      body: (
        <>
          <Textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={4} placeholder="Em uma ou duas frases, sem frase de efeito." />
          <Chips items={GOAL_CHIPS} onPick={(c) => appendLine(c, goals, setGoals)} />
        </>
      ),
    },
    {
      title: "Quais projetos existem hoje?",
      hint: "O primeiro da lista vira prioridade alta. Próxima prova é o próximo fato que prova que o projeto anda (ex.: 1 cliente usando).",
      body: (
        <div className="space-y-3">
          {projects.map((p, i) => (
            <div key={i} className="space-y-2 rounded-[10px] border border-line bg-surface p-3">
              <div className="flex gap-2">
                <Input value={p.name} onChange={(e) => updateProject(i, { name: e.target.value })} placeholder="Nome do projeto" aria-label="Nome do projeto" />
                {projects.length > 1 ? (
                  <button type="button" aria-label="Remover" onClick={() => setProjects((ps) => ps.filter((_, j) => j !== i))} className="grid h-11 w-11 shrink-0 place-items-center text-muted"><X size={16} /></button>
                ) : null}
              </div>
              <Select value={p.status} onChange={(e) => updateProject(i, { status: e.target.value })} aria-label="Estado">
                {Object.entries(PROJECT_STATUS_LABEL).filter(([k]) => k !== "encerrado").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <Input value={p.proof} onChange={(e) => updateProject(i, { proof: e.target.value })} placeholder="Próxima prova concreta (opcional)" aria-label="Próxima prova" />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {projects.length < 6 ? (
              <Button type="button" size="sm" onClick={() => setProjects((ps) => [...ps, { name: "", status: "construcao", proof: "" }])}><Plus size={14} /> Outro projeto</Button>
            ) : null}
            {PROJECT_SUGGESTIONS.filter((s) => !projects.some((p) => p.name.toLowerCase() === s.toLowerCase())).map((s) => (
              <button key={s} type="button" onClick={() => setProjects((ps) => {
                const empty = ps.findIndex((p) => !p.name);
                if (empty >= 0) return ps.map((p, j) => (j === empty ? { ...p, name: s } : p));
                return [...ps, { name: s, status: "construcao", proof: "" }];
              })} className="h-8 rounded-full border border-dashed border-line-strong px-3 text-[13px] text-muted">+ {s}</button>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: "Quais habilidades você quer trabalhar?",
      body: (
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((s) => {
            const on = skills.includes(s);
            return (
              <button key={s} type="button" aria-pressed={on} onClick={() => setSkills((xs) => (on ? xs.filter((x) => x !== s) : [...xs, s]))}
                className={cx("h-9 rounded-full border px-3.5 text-sm", on ? "border-accent bg-accent text-accent-fg" : "border-line text-muted")}>{s}</button>
            );
          })}
        </div>
      ),
    },
    {
      title: "Quais problemas se repetem?",
      hint: "Isso vira critério. O sistema vai apontar quando o padrão aparecer.",
      body: (
        <>
          <Textarea value={problems} onChange={(e) => setProblems(e.target.value)} rows={4} placeholder="Seja honesto. Ninguém mais lê isso." />
          <Chips items={PROBLEMS} onPick={(c) => appendLine(c, problems, setProblems)} />
        </>
      ),
    },
    {
      title: "Como você quer ser confrontado?",
      body: (
        <div className="space-y-2">
          {[
            ["suave", "Suave", "Aponta o problema com cuidado."],
            ["direto", "Direto", "Aponta o problema sem rodeio."],
            ["muito_direto", "Muito direto", "“Isso não fecha.” “Você não validou isso.”"],
          ].map(([k, label, desc]) => (
            <button key={k} type="button" onClick={() => setReality(k)} aria-pressed={reality === k}
              className={cx("flex w-full items-start gap-3 rounded-[10px] border p-3.5 text-left", reality === k ? "border-accent bg-accent-soft" : "border-line")}>
              <span className={cx("mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2", reality === k ? "border-accent bg-accent" : "border-line-strong")} />
              <span><span className="block font-medium">{label}</span><span className="text-sm text-muted">{desc}</span></span>
            </button>
          ))}
        </div>
      ),
    },
  ];

  const last = step === steps.length - 1;

  return (
    <form action={action} onSubmit={(e) => { if (!last) { e.preventDefault(); setStep((s) => s + 1); } }}>
      {/* Estado do formulário inteiro vai junto no envio */}
      <input type="hidden" name="goals" value={goals} />
      <input type="hidden" name="problems" value={problems} />
      <input type="hidden" name="reality" value={reality} />
      {skills.map((s) => <input key={s} type="hidden" name="skills" value={s} />)}
      {projects.map((p, i) => (
        <span key={i}>
          <input type="hidden" name="project_name" value={p.name} />
          <input type="hidden" name="project_status" value={p.status} />
          <input type="hidden" name="project_proof" value={p.proof} />
        </span>
      ))}

      <div className="mb-8 flex items-center gap-3">
        <Image src="/logo-mark.png" alt="" width={26} height={26} className="rounded-[6px]" />
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">{name ? `${name}, ` : ""}5 perguntas</span>
        <span className="ml-auto text-sm tabular-nums text-muted">{step + 1}/{steps.length}</span>
      </div>
      <div className="mb-6 flex gap-1" aria-hidden>
        {steps.map((_, i) => <span key={i} className={cx("h-1 flex-1 rounded-full", i <= step ? "bg-accent" : "bg-line")} />)}
      </div>

      <h1 className="text-[24px] font-semibold leading-tight tracking-tight">{steps[step].title}</h1>
      {steps[step].hint ? <p className="mt-1.5 text-sm text-muted">{steps[step].hint}</p> : null}
      <div className="mt-5 space-y-3">{steps[step].body}</div>

      {state.error ? <div className="mt-4"><ErrorNote>{state.error}</ErrorNote></div> : null}

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Voltar</Button>
        {last ? (
          <Button key="concluir" type="submit" variant="primary" disabled={pending}>{pending ? "Montando sua primeira sessão…" : "Concluir"}</Button>
        ) : (
          <Button key="continuar" type="button" variant="primary" onClick={(e) => { e.preventDefault(); setStep((s) => s + 1); }}>Continuar</Button>
        )}
      </div>
    </form>
  );
}

function Chips({ items, onPick }: { items: string[]; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <button key={c} type="button" onClick={() => onPick(c)} className="h-8 rounded-full border border-line px-3 text-[13px] text-muted hover:border-line-strong hover:text-ink">{c}</button>
      ))}
    </div>
  );
}
