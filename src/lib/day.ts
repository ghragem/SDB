// Motor de regras do dia. Funciona sem IA, usando só dados reais do usuário.
// Tudo que sai daqui é marcado como "regras" na interface.

import { daysSince } from "./format";
import { dayMode } from "./engine";
import { LESSONS } from "./lessons";
import { ACTIVE_STATUSES, type DayState, type Project, type SessionItem } from "./types";

export type DayInput = {
  energy: number | null;
  focus: number | null;
  pressure: number | null;
  mainWorry: string | null;
  text: string | null;
};

export type DayContext = {
  projects: Project[];
  ideasLast7d: number;
  pendingIdeas: number;
  decisionsDue: { id: string; title: string }[];
  openDecisions: number;
};

export type Signals = {
  money: boolean;
  newIdea: boolean;
  tired: boolean;
  study: boolean;
  mentionedProjects: Project[];
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function readSignals(input: DayInput, projects: Project[]): Signals {
  const t = norm(`${input.text ?? ""} ${input.mainWorry ?? ""}`);
  const has = (...words: string[]) => words.some((w) => t.includes(w));
  return {
    money: has("dinheiro", "grana", "boleto", "conta pra pagar", "contas", "caixa", "divida", "pagar", "faturamento", "lucro", "prejuizo"),
    newIdea: has("outra ideia", "nova ideia", "tive uma ideia", "pensei em criar", "pensei em abrir", "ideia nova", "novo projeto", "comecar outra"),
    tired: has("cansado", "cansaco", "exausto", "sem energia", "sem vontade", "morto", "dormi mal", "nao dormi", "desanimado", "travado"),
    study: has("estudar", "faculdade", "prova", "fac", "trabalho da", "aula"),
    mentionedProjects: projects.filter((p) => p.name.length >= 3 && t.includes(norm(p.name))),
  };
}

/** Mesma regra objetiva da Hoje (engine.dayMode), para leitura e tela nunca discordarem. */
export function computeDayState(input: DayInput, signals: Signals): DayState {
  return dayMode(input.energy, input.focus, input.pressure, signals.tired).state;
}

const STATUS_WEIGHT: Record<string, number> = {
  validacao: 0, construcao: 1, operando: 2, escalando: 3, planejamento: 4,
};

/** Projeto prioritário: prioridade declarada, depois o mais perto de prova real, depois o mais parado. */
export function pickPriorityProject(projects: Project[]): Project | null {
  const active = projects.filter((p) => ACTIVE_STATUSES.includes(p.status));
  if (!active.length) return null;
  return [...active].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const s = (STATUS_WEIGHT[a.status] ?? 9) - (STATUS_WEIGHT[b.status] ?? 9);
    if (s) return s;
    return (daysSince(b.last_progress_at ?? b.created_at) ?? 0) - (daysSince(a.last_progress_at ?? a.created_at) ?? 0);
  })[0];
}

const MINUTES: Record<DayState, { projeto: number; estudo: number; falar: number; decisao: number }> = {
  ataque: { projeto: 20, estudo: 10, falar: 10, decisao: 5 },
  normal: { projeto: 15, estudo: 8, falar: 5, decisao: 0 },
  sobrevivencia: { projeto: 5, estudo: 0, falar: 0, decisao: 0 },
};

export function pickLesson(input: DayInput, signals: Signals, ctx: DayContext) {
  if (signals.newIdea || ctx.ideasLast7d >= 3) return LESSONS.find((l) => l.slug === "custo-de-oportunidade")!;
  if (signals.money) return LESSONS.find((l) => l.slug === "margem-de-contribuicao")!;
  if ((input.pressure ?? 0) >= 4 || ctx.openDecisions > 0) return LESSONS.find((l) => l.slug === "aversao-a-perda")!;
  const p = pickPriorityProject(ctx.projects);
  if (p?.status === "validacao") return LESSONS.find((l) => l.slug === "hipotese-e-criterio-de-parada")!;
  return LESSONS.find((l) => l.slug === "pitch-60-segundos")!;
}

export function buildRulesDay(input: DayInput, ctx: DayContext) {
  const signals = readSignals(input, ctx.projects);
  const state = computeDayState(input, signals);
  const priority = pickPriorityProject(ctx.projects);
  const lines: string[] = [];

  // Leitura
  const fronts = new Set<string>(signals.mentionedProjects.map((p) => p.id));
  if (signals.newIdea) fronts.add("ideia");
  if (signals.study) fronts.add("estudo");
  if (fronts.size >= 3) lines.push(`Você está tentando dividir atenção entre ${fronts.size} frentes.`);

  if (state === "sobrevivencia") {
    lines.push("Hoje você está abaixo do normal. Não abra nenhuma frente nova. Faça os itens abaixo, registre o resultado e encerre.");
  } else if (state === "ataque") {
    lines.push("Energia e foco altos. Bom dia para atacar a parte mais difícil do projeto prioritário, não para começar outro.");
  }

  if (signals.money) {
    lines.push("A preocupação com dinheiro aumenta sua sensibilidade a risco. Nenhuma decisão financeira irreversível hoje.");
  } else if ((input.pressure ?? 0) >= 4) {
    lines.push("Pressão alta. Se precisar decidir algo grande, registre em Decidir e decida com regra, não com urgência.");
  }

  if (signals.newIdea && priority) {
    lines.push(`Apareceu ideia nova. Ela vai para Ideias, não para hoje. Não existe razão registrada para ela passar na frente de ${priority.name}.`);
  } else if (ctx.ideasLast7d >= 3 && priority) {
    lines.push(`Você registrou ${ctx.ideasLast7d} ideias nos últimos 7 dias. ${priority.name} continua sendo o projeto ativo.`);
  }

  if (priority) {
    const idle = daysSince(priority.last_progress_at);
    if (idle === null) lines.push(`${priority.name} ainda não tem nenhum avanço registrado aqui.`);
    else if (idle >= 4) lines.push(`${priority.name} está há ${idle} dias sem avanço registrado.`);
  } else {
    lines.push("Nenhum projeto ativo cadastrado. Sem isso não há como calcular prioridade.");
  }

  if (ctx.decisionsDue.length) {
    lines.push(`${ctx.decisionsDue.length === 1 ? "Uma decisão precisa" : `${ctx.decisionsDue.length} decisões precisam`} ser revisada${ctx.decisionsDue.length === 1 ? "" : "s"} hoje.`);
  }

  // Sessão
  const m = MINUTES[state];
  const items: SessionItem[] = [];
  if (priority) {
    let detail: string;
    if (priority.next_action) detail = `Próxima ação: ${priority.next_action}`;
    else if (priority.blocker) detail = `Atacar o bloqueio: ${priority.blocker}`;
    else if (priority.next_proof) detail = `Avançar até a próxima prova: ${priority.next_proof}`;
    else detail = "Definir a próxima prova concreta deste projeto. Sem ela não dá para medir avanço.";
    items.push({ kind: "projeto", title: priority.name, detail, minutes: m.projeto, href: `/projetos/${priority.id}`, ref_id: priority.id });
  } else {
    items.push({ kind: "projeto", title: "Cadastrar projeto", detail: "Registre o projeto que mais importa hoje, com a próxima prova concreta.", minutes: 5, href: "/projetos/novo" });
  }

  if (state === "sobrevivencia") {
    items.push({ kind: "revisao", title: "Revisão curta", detail: "Responda as três perguntas do dia e encerre.", minutes: 3, href: "/review" });
  } else {
    const lesson = pickLesson(input, signals, ctx);
    items.push({ kind: "estudo", title: lesson.title, detail: lesson.why, minutes: Math.min(m.estudo, lesson.minutes) || lesson.minutes, href: `/aprender/${lesson.slug}`, ref_id: lesson.slug });
    const pitchTarget = priority ? priority.name : "o que você faz";
    items.push({ kind: "falar", title: "Oratória", detail: `Explique ${pitchTarget} para um cliente em 60 segundos. Grave.`, minutes: m.falar, href: `/falar?tema=${encodeURIComponent(`Explique ${pitchTarget} para um cliente em 60 segundos.`)}` });
    if (state === "ataque" || ctx.decisionsDue.length || signals.newIdea) {
      const d = ctx.decisionsDue[0];
      items.push(
        d
          ? { kind: "decisao", title: "Revisar decisão", detail: d.title, minutes: 5, href: `/decidir/${d.id}`, ref_id: d.id }
          : { kind: "decisao", title: "Decisão", detail: priority ? `Existe alguma ideia tentando passar na frente de ${priority.name}?` : "Existe algo que precisa parar?", minutes: m.decisao || 3, href: "/ideias" },
      );
    }
  }

  return { state, reading: lines.slice(0, 4).join(" "), items, priority, signals };
}
