// Aprender: trilhas por habilidade e recomendação com "por que agora" tirado dos dados reais.
// Conteúdo externo (vídeo, artigo, autor) só entra com fonte real. Busca automática de conteúdo
// depende de integração (YouTube / busca na web) que ainda não existe — por isso nada externo é sugerido aqui.

import { LESSONS, type Lesson } from "./lessons";

export type Track = { skill: string; lessons: Lesson[] };

/** Trilhas = habilidades. Novas aulas entram na trilha pela área. */
export function tracks(): Track[] {
  const by = new Map<string, Lesson[]>();
  for (const l of LESSONS) by.set(l.area, [...(by.get(l.area) ?? []), l]);
  return [...by.entries()].map(([skill, lessons]) => ({ skill, lessons }));
}

export type LearnSignals = {
  activeProjects: number;
  ideasLast7d: number;
  dispersion: boolean;
  revenueNoCost: string[];     // projetos com receita e nenhum custo
  looseSpend: number;          // gastos sem projeto (30 dias)
  openDecisions: number;
  topStatus: string | null;
  topName: string | null;
  runningExperiments: number;
  moneyWorry: boolean;         // check-in de hoje fala de dinheiro
};

export type Recommendation = { lesson: Lesson; why: string };

/** Só recomenda com motivo verificável. Sem sinal, não recomenda nada. */
export function recommend(s: LearnSignals, doneSlugs: Set<string>): Recommendation[] {
  const out: Recommendation[] = [];
  const add = (slug: string, why: string) => {
    const lesson = LESSONS.find((l) => l.slug === slug);
    if (lesson && !out.some((r) => r.lesson.slug === slug)) out.push({ lesson, why });
  };
  if (s.dispersion || (s.ideasLast7d >= 2 && s.activeProjects >= 3))
    add("custo-de-oportunidade", `Você criou ${s.ideasLast7d} ideia(s) em 7 dias com ${s.activeProjects} projetos ativos.`);
  if (s.revenueNoCost.length)
    add("margem-de-contribuicao", `${s.revenueNoCost.join(", ")} tem receita registrada e nenhum custo: a margem real é desconhecida.`);
  else if (s.looseSpend > 0)
    add("margem-de-contribuicao", `${s.looseSpend} gasto(s) sem projeto nos últimos 30 dias: sem isso não dá para medir margem por projeto.`);
  else if (s.moneyWorry)
    add("margem-de-contribuicao", "Seu check-in de hoje fala de dinheiro.");
  if (s.openDecisions > 0)
    add("aversao-a-perda", `Você tem ${s.openDecisions} decisão(ões) aberta(s). Medo de perder distorce a escolha.`);
  if (s.runningExperiments > 0 || s.topStatus === "validacao")
    add("hipotese-e-criterio-de-parada", s.runningExperiments ? `${s.runningExperiments} experimento(s) rodando: precisam de critério de parada.` : `${s.topName} está em validação.`);
  if (s.topName && !out.length)
    add("pitch-60-segundos", `Explicar ${s.topName} em 60 segundos é a base para vender e validar.`);
  // Ainda não feitas primeiro
  return out.sort((a, b) => Number(doneSlugs.has(a.lesson.slug)) - Number(doneSlugs.has(b.lesson.slug))).slice(0, 2);
}
