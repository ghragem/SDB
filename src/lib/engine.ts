// Motor operacional. Funciona sem IA: só regras fixas sobre dados registrados.
// Tudo aqui é puro (sem banco, sem rede) para ser previsível e testável.
// Regra da rodada: cada número mostrado sai de um dado real; nada é estimado.

import type { DayState, ProjectStatus } from "./types";

// ---------------------------------------------------------------------------
// Datas (dias corridos no fuso de São Paulo, comparando YYYY-MM-DD)
// ---------------------------------------------------------------------------
const TZ = "America/Sao_Paulo";
export const ymd = (d: Date | string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(typeof d === "string" ? new Date(d) : d);
/** Dias de `from` até `to` (ambos YYYY-MM-DD ou ISO). Positivo = `to` depois. */
export function dayDiff(from: string, to: string) {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}
const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------------------
// Modo do dia
// ---------------------------------------------------------------------------
export type DayMode = { state: DayState; reason: string; objective: boolean };

/**
 * Regra objetiva (escala 1–5):
 * Sobrevivência: energia ≤ 2, foco ≤ 2, pressão 5, ou pressão ≥ 4 com energia ou foco ≤ 3.
 * Ataque: energia ≥ 4, foco ≥ 4 e pressão ≤ 3.
 * Normal: o resto.
 * Sem números no check-in, o modo é estimado pelo texto e a tela diz isso.
 */
export function dayMode(energy: number | null, focus: number | null, pressure: number | null, tiredText = false): DayMode {
  if (energy !== null && focus !== null) {
    const nums = `Energia ${energy} · foco ${focus}${pressure !== null ? ` · pressão ${pressure}` : ""}`;
    const p = pressure ?? 0;
    if (energy <= 2 || focus <= 2 || p >= 5 || (p >= 4 && Math.min(energy, focus) <= 3)) {
      const why = energy <= 2 ? "energia baixa" : focus <= 2 ? "foco baixo" : "pressão alta";
      return { state: "sobrevivencia", reason: `${nums}: ${why}.`, objective: true };
    }
    if (energy >= 4 && focus >= 4 && p <= 3) return { state: "ataque", reason: `${nums}: energia e foco altos.`, objective: true };
    return { state: "normal", reason: `${nums}: estado intermediário.`, objective: true };
  }
  return tiredText
    ? { state: "sobrevivencia", reason: "Sem números no check-in. Estimado pelo texto: você falou em cansaço.", objective: false }
    : { state: "normal", reason: "Sem números no check-in. Marque energia, foco e pressão para o modo ser exato.", objective: false };
}

// ---------------------------------------------------------------------------
// Próxima ação: obrigatória e concreta
// ---------------------------------------------------------------------------
export type ActionQuality = { level: "ok" | "vaga" | "ausente"; reason: string | null };

const VAGUE_START = new Set([
  "melhorar", "ver", "pensar", "organizar", "mexer", "trabalhar", "estudar", "ajustar", "continuar", "fazer", "verificar",
  "resolver", "planejar", "avancar", "desenvolver", "focar", "tentar", "olhar", "cuidar", "arrumar", "revisar", "otimizar", "evoluir",
]);
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const ACTION_EXAMPLE = "Ligar para 3 oficinas e validar o fluxo de orçamento.";

export function actionQuality(text: string | null | undefined): ActionQuality {
  const t = (text ?? "").trim();
  if (!t) return { level: "ausente", reason: "Este projeto não tem próxima ação definida." };
  const words = t.split(/\s+/).filter(Boolean);
  const first = fold(words[0]).replace(/[^a-z]/g, "");
  const hasNumber = /\d/.test(t);
  if (words.length < 4) return { level: "vaga", reason: `“${t}” é curto demais para executar sem pensar de novo.` };
  if (VAGUE_START.has(first) && !hasNumber) return { level: "vaga", reason: `Começa com “${words[0].toLowerCase()}” e não diz o quê, quanto ou com quem.` };
  return { level: "ok", reason: null };
}

// ---------------------------------------------------------------------------
// Score de prioridade (explicável)
// ---------------------------------------------------------------------------
export type ScoreProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  priority: number;              // 1 alta · 2 média · 3 baixa
  next_action: string | null;
  next_proof: string | null;
  blocker: string | null;
  deadline: string | null;       // YYYY-MM-DD
  next_action_at?: string | null;
  last_progress_at: string | null;
  created_at: string;
};
export type ProjectFacts = {
  progressCount: number;         // avanços registrados (total)
  revenue90: number;             // receita ligada ao projeto, últimos 90 dias
  spent90: number;               // despesa + investimento ligados ao projeto, últimos 90 dias
};
export type Factor = { label: string; points: number };
export type Scored = { project: ScoreProject; score: number; factors: Factor[]; idleDays: number; neverProgressed: boolean; action: ActionQuality };

/** Tabela fixa. Aparece na tela "Como o score é calculado". */
export const SCORE_RULES: [string, string][] = [
  ["Prioridade que você definiu", "alta +30 · média +15 · baixa 0"],
  ["Prazo", "vencido +25 · até 3 dias +20 · até 7 dias +12 · até 14 dias +5"],
  ["Dias sem avanço", "14+ dias +25 · 7+ dias +20 · 4+ dias +10. Vale inteiro na prioridade alta, metade na média, zero na baixa: projeto secundário parado vai para “Projetos sem avanço”, não para o topo"],
  ["Próxima ação", "concreta +15 · vaga +5 · ausente −10"],
  ["Estágio", "validação +15 · construção ou operando +10"],
  ["Dinheiro (90 dias)", "tem receita +10 · só gasto, sem receita +5"],
  ["Custo de abandonar", "5+ avanços registrados +10 · 2 a 4 avanços +5"],
  ["Bloqueio registrado", "+5 (destravar vale mais que abrir outra frente)"],
  ["Modo do dia", "Sobrevivência: principal +10, demais −10 · Ataque: projeto com bloqueio +10"],
];

export const ACTIVE: ProjectStatus[] = ["planejamento", "construcao", "validacao", "operando", "escalando"];

export function scoreProject(p: ScoreProject, f: ProjectFacts, today: string, state: DayState | null, isTopByPriority: boolean): Scored {
  const factors: Factor[] = [];
  const add = (points: number, label: string) => factors.push({ label, points });

  add(p.priority === 1 ? 30 : p.priority === 2 ? 15 : 0, p.priority === 1 ? "prioridade alta" : p.priority === 2 ? "prioridade média" : "prioridade baixa");

  if (p.deadline) {
    const d = dayDiff(today, p.deadline);
    if (d < 0) add(25, `prazo vencido há ${plural(-d, "dia", "dias")}`);
    else if (d <= 3) add(20, d === 0 ? "prazo é hoje" : `prazo em ${plural(d, "dia", "dias")}`);
    else if (d <= 7) add(12, `prazo em ${d} dias`);
    else if (d <= 14) add(5, `prazo em ${d} dias`);
  }

  const neverProgressed = !p.last_progress_at;
  const idleDays = Math.max(0, dayDiff(ymd(p.last_progress_at ?? p.created_at), today));
  const idleLabel = neverProgressed ? `sem avanço desde o cadastro (${plural(idleDays, "dia", "dias")})` : `${plural(idleDays, "dia", "dias")} sem avanço`;
  const idleBase = idleDays >= 14 ? 25 : idleDays >= 7 ? 20 : idleDays >= 4 ? 10 : 0;
  const idleWeight = p.priority === 1 ? 1 : p.priority === 2 ? 0.5 : 0;
  if (idleBase) add(Math.round(idleBase * idleWeight), idleWeight === 1 ? idleLabel : `${idleLabel}${idleWeight ? " (peso metade: prioridade média)" : " (prioridade baixa não sobe por estar parada)"}`);

  const action = actionQuality(p.next_action);
  if (action.level === "ok") add(15, "próxima ação definida");
  else if (action.level === "vaga") add(5, "próxima ação vaga");
  else add(-10, "sem próxima ação");

  if (p.status === "validacao") add(15, "em validação (perto da prova)");
  else if (p.status === "construcao") add(10, "em construção");
  else if (p.status === "operando" || p.status === "escalando") add(10, "operando");

  if (f.revenue90 > 0) add(10, `${brl(f.revenue90)} de receita em 90 dias`);
  else if (f.spent90 > 0) add(5, `${brl(f.spent90)} gastos sem receita registrada (90 dias)`);

  if (f.progressCount >= 5) add(10, `${f.progressCount} avanços registrados`);
  else if (f.progressCount >= 2) add(5, `${f.progressCount} avanços registrados`);

  if (p.blocker) add(5, "bloqueio registrado");

  if (state === "sobrevivencia") add(isTopByPriority ? 10 : -10, isTopByPriority ? "sobrevivência: proteger o principal" : "sobrevivência: reduzir escopo");
  else if (state === "ataque" && p.blocker) add(10, "ataque: bom dia para destravar o bloqueio");

  return { project: p, score: factors.reduce((a, x) => a + x.points, 0), factors, idleDays, neverProgressed, action };
}

/** Ordena projetos ativos pelo score. Empate: prioridade definida, depois o mais parado. */
export function rankProjects(projects: ScoreProject[], facts: Map<string, ProjectFacts>, today: string, state: DayState | null): Scored[] {
  const active = projects.filter((p) => ACTIVE.includes(p.status));
  const topPriority = [...active].sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at))[0]?.id;
  const empty: ProjectFacts = { progressCount: 0, revenue90: 0, spent90: 0 };
  return active
    .map((p) => scoreProject(p, facts.get(p.id) ?? empty, today, state, p.id === topPriority))
    .sort((a, b) => b.score - a.score || a.project.priority - b.project.priority || b.idleDays - a.idleDays);
}

// ---------------------------------------------------------------------------
// Decisões e risco
// ---------------------------------------------------------------------------
export type DecisionRow = {
  id: string; title: string; status: string; verdict: string | null; deadline: string | null; review_at: string | null;
  amount: number | null; max_loss: number | null; reversibility: string | null;
  evidence: string | null; downside: string | null; alternatives: string | null; premortem: string | null; created_at: string;
};
export type QueuedDecision = { d: DecisionRow; attention: number; reason: string; missing: string[] };

const REQUIRED: [keyof DecisionRow, string][] = [
  ["deadline", "prazo"], ["max_loss", "perda máxima"], ["reversibility", "reversibilidade"],
  ["evidence", "evidências"], ["downside", "downside"], ["alternatives", "alternativas"],
];

/** Ordem de atenção: revisão atrasada, prazo vencendo, sem veredito, dados faltando. */
export function decisionQueue(rows: DecisionRow[], today: string): QueuedDecision[] {
  return rows
    .filter((d) => d.status === "aberta" || d.status === "decidida")
    .map((d) => {
      const missing = REQUIRED.filter(([k]) => d[k] === null || d[k] === "").map(([, l]) => l);
      let attention = missing.length;
      let reason = missing.length ? `faltam ${plural(missing.length, "dado", "dados")}` : "completa";
      if (d.status === "aberta" && !d.verdict) { attention += 10; reason = "sem veredito"; }
      if (d.deadline && d.status === "aberta") {
        const left = dayDiff(today, d.deadline);
        if (left < 0) { attention += 40; reason = `prazo venceu em ${ddmm(d.deadline)}`; }
        else if (left <= 3) { attention += 30 - left; reason = left === 0 ? "prazo é hoje" : `prazo em ${plural(left, "dia", "dias")}`; }
      }
      if (d.review_at && d.review_at <= today && d.status === "decidida") { attention += 50; reason = `revisão era ${ddmm(d.review_at)}`; }
      return { d, attention, reason, missing };
    })
    .sort((a, b) => b.attention - a.attention || a.d.created_at.localeCompare(b.d.created_at));
}

export type ExperimentRow = {
  id: string; hypothesis: string; status: string; max_amount: number | null; deadline: string | null;
  stop_condition: string | null; scale_condition: string | null; decision_id: string | null; spent: number;
};
export type RiskRow = { e: ExperimentRow; pct: number | null; overdue: boolean; message: string | null };

export function riskQueue(rows: ExperimentRow[], today: string): RiskRow[] {
  return rows
    .filter((e) => e.status === "rodando" || e.status === "planejado")
    .map((e) => {
      const pct = e.max_amount && e.max_amount > 0 ? Math.round((e.spent / e.max_amount) * 100) : null;
      const overdue = Boolean(e.deadline && e.deadline < today);
      let message: string | null = null;
      if (pct !== null && pct >= 100) message = `Limite estourado: ${pct}% gasto. A regra era parar.`;
      else if (pct !== null && pct >= 80) message = `Você já consumiu ${pct}% do limite deste teste.`;
      else if (overdue) message = `Prazo venceu em ${ddmm(e.deadline!)} sem conclusão registrada.`;
      return { e, pct, overdue, message };
    })
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || Number(b.overdue) - Number(a.overdue));
}

// ---------------------------------------------------------------------------
// Alertas (anti-dispersão e o que está vencendo). Hoje mostra só o primeiro.
// ---------------------------------------------------------------------------
export type Alert = { key: string; severity: number; text: string; href: string; cta: string };

export type AlertInput = {
  today: string;
  state: DayState | null;
  ranked: Scored[];
  ideasLast7d: { id: string; created_at: string }[];
  decisions: QueuedDecision[];
  risks: RiskRow[];
};

export function computeAlerts(i: AlertInput): Alert[] {
  const out: Alert[] = [];
  const top = i.ranked[0];

  if (top) {
    const p = top.project;
    const ideas = i.ideasLast7d.filter((x) => x.created_at > (p.last_progress_at ?? p.created_at)).length;
    if (ideas >= 2 && top.idleDays >= 5) {
      out.push({ key: "dispersao-ideias", severity: 9, href: "/ideias", cta: "Ver ideias",
        text: `Você abriu ${ideas} ideias novas enquanto ${p.name} está parado há ${top.idleDays} dias.` });
    } else if (top.idleDays >= 7) {
      out.push({ key: `parado-${p.id}`, severity: 7, href: `/projetos/${p.id}`, cta: "Abrir projeto",
        text: `${p.name} é a prioridade #1 e está há ${top.idleDays} dias sem avanço.` });
    }
    if (top.action.level !== "ok") {
      out.push({ key: `acao-${p.id}`, severity: 6, href: `/projetos/${p.id}#proxima-acao`, cta: "Definir ação",
        text: top.action.level === "ausente" ? `${p.name} não tem próxima ação definida.` : `A próxima ação de ${p.name} está vaga. ${top.action.reason}` });
    }
    // Projeto novo começou antes do principal fechar a prova
    for (const s of i.ranked.slice(1)) {
      const startedAfter = dayDiff(ymd(p.created_at), ymd(s.project.created_at));
      const age = dayDiff(ymd(s.project.created_at), i.today);
      if (startedAfter >= 1 && age <= 14 && (p.status === "construcao" || p.status === "validacao")) {
        out.push({ key: `novo-${s.project.id}`, severity: 8, href: `/projetos/${s.project.id}`, cta: "Pausar ou justificar",
          text: `${s.project.name} começou há ${plural(age, "dia", "dias")} enquanto ${p.name} ainda não fechou a próxima prova${p.next_proof ? `: ${p.next_proof.slice(0, 80)}${p.next_proof.length > 80 ? "…" : ""}` : ""}.` });
        break;
      }
    }
  }

  if (i.ranked.length >= 4) {
    out.push({ key: "muitos-ativos", severity: 5, href: "/projetos", cta: "Escolher o que pausar",
      text: `${i.ranked.length} projetos ativos ao mesmo tempo. Algum precisa ser pausado.` });
  }

  for (const q of i.decisions.slice(0, 3)) {
    if (q.attention >= 50) out.push({ key: `rev-${q.d.id}`, severity: 9, href: `/decidir/${q.d.id}`, cta: "Revisar", text: `Decisão “${q.d.title}”: ${q.reason}. Compare previsão com realidade.` });
    else if (q.attention >= 27) out.push({ key: `dec-${q.d.id}`, severity: 8, href: `/decidir/${q.d.id}`, cta: "Decidir", text: `Decisão “${q.d.title}”: ${q.reason}.` });
    if (i.state === "sobrevivencia" && q.d.reversibility === "irreversivel" && q.d.status === "aberta") {
      out.push({ key: `sob-${q.d.id}`, severity: 7, href: `/decidir/${q.d.id}`, cta: "Ver decisão",
        text: `Dia de sobrevivência: não feche “${q.d.title}” hoje. É irreversível.` });
    }
  }

  for (const r of i.risks) {
    if (r.message) out.push({ key: `risco-${r.e.id}`, severity: r.pct !== null && r.pct >= 80 ? 9 : 7, href: "/decidir#risco", cta: "Ver teste", text: `${r.message} (${r.e.hypothesis.slice(0, 70)})` });
  }

  return out.sort((a, b) => b.severity - a.severity);
}

// ---------------------------------------------------------------------------
// Próximas ações do dia (máximo 3)
// ---------------------------------------------------------------------------
export type NextAction = { key: string; label: string; detail: string | null; href: string; done: boolean; define?: { projectId: string; projectName: string } };

export type ActionsInput = {
  state: DayState | null;
  ranked: Scored[];
  progressedToday: Map<string, string>;  // projeto → horário do último avanço registrado hoje
  carriedFromYesterday: string | null;   // "primeira ação de amanhã" da revisão de ontem
  decisions: QueuedDecision[];
  risks: RiskRow[];
  reviewDone: boolean;
};

export function nextActions(i: ActionsInput): NextAction[] {
  const out: NextAction[] = [];
  // Feita = avanço registrado hoje DEPOIS de a ação ser definida (avanço anterior não conta).
  const doneFor = (p: ScoreProject) => {
    const at = i.progressedToday.get(p.id);
    return Boolean(at && (!p.next_action_at || at > p.next_action_at));
  };
  const top = i.ranked[0];
  const survival = i.state === "sobrevivencia";

  if (i.carriedFromYesterday) {
    out.push({ key: "ontem", label: i.carriedFromYesterday, detail: "Você deixou decidido ontem como primeira ação.", href: "/review", done: false });
  }

  if (top) {
    const p = top.project;
    if (top.action.level === "ausente") {
      out.push({ key: `def-${p.id}`, label: `Definir a próxima ação de ${p.name}`, detail: "Sem ela, o projeto não anda. Uma frase com verbo, número ou pessoa.", href: `/projetos/${p.id}#proxima-acao`, done: false, define: { projectId: p.id, projectName: p.name } });
    } else {
      out.push({ key: `acao-${p.id}`,
        label: survival ? `5 minutos em ${p.name}: ${p.next_action}` : `${p.name}: ${p.next_action}`,
        detail: survival ? "Ação pequena só para manter o movimento. Registre o avanço e pare." : top.action.level === "vaga" ? "Está vaga. Reescreva concreta antes de começar." : null,
        href: `/projetos/${p.id}`, done: doneFor(p) });
    }
  }

  if (!survival) {
    const risk = i.risks.find((r) => r.message);
    const dec = i.decisions.find((q) => q.attention >= 27);
    if (risk) out.push({ key: `risco-${risk.e.id}`, label: `Checar o teste: ${risk.e.hypothesis.slice(0, 80)}`, detail: risk.message, href: "/decidir#risco", done: false });
    else if (dec) out.push({ key: `dec-${dec.d.id}`, label: `Decidir: ${dec.d.title}`, detail: dec.reason, href: `/decidir/${dec.d.id}`, done: false });
    const second = i.ranked[1];
    if (second && second.action.level === "ok") {
      out.push({ key: `acao-${second.project.id}`, label: `${second.project.name}: ${second.project.next_action}`, detail: `#2 na fila (score ${second.score}).`, href: `/projetos/${second.project.id}`, done: doneFor(second.project) });
    }
  }

  out.push({ key: "revisao", label: "Revisão do dia (2 min)", detail: "O que avançou, onde perdeu tempo, decisão pendente, primeira ação de amanhã.", href: "/review", done: i.reviewDone });

  // Máximo 3. A revisão fica sempre como última.
  const review = out.pop()!;
  return [...out.slice(0, 2), review];
}
