// Interpretação de captura por regras (sem IA): fala/texto livre → registros sugeridos.
// Nada aqui grava no banco. O resultado vai para a tela "Entendi isso" e só é salvo após confirmação.
// Regras simples e previsíveis; quando não reconhece, vira "nota" com confiança baixa em vez de chutar.

export type CaptureKind =
  | "avanco" | "evidencia" | "bloqueio" | "despesa" | "receita" | "ideia"
  | "aprendizado" | "hipotese" | "decisao" | "tarefa" | "nota";

export type CaptureItem = {
  id: string;
  kind: CaptureKind;
  text: string;
  projectId: string | null;
  amount: number | null;
  confidence: "alta" | "media" | "baixa";
  why: string;
};

export type ProjectRef = { id: string; name: string };

export const KIND_LABEL: Record<CaptureKind, string> = {
  avanco: "Avanço de projeto",
  evidencia: "Evidência",
  bloqueio: "Bloqueio",
  despesa: "Despesa",
  receita: "Receita",
  ideia: "Ideia",
  aprendizado: "Aprendizado",
  hipotese: "Hipótese",
  decisao: "Decisão / observação",
  tarefa: "Tarefa",
  nota: "Nota",
};

/** Onde cada tipo é salvo (mostrado no card de confirmação). */
export function destination(kind: CaptureKind, hasProject: boolean, hasAmount: boolean): string {
  switch (kind) {
    case "avanco": return hasProject ? "linha do tempo do projeto (conta como avanço)" : "Inbox (falta o projeto)";
    case "evidencia": return hasProject ? "linha do tempo do projeto (evidência)" : "Brain (fato)";
    case "bloqueio": return hasProject ? "linha do tempo do projeto (bloqueio)" : "Inbox (falta o projeto)";
    case "despesa": case "receita": return hasAmount ? "Dinheiro" : "Inbox (falta o valor)";
    case "ideia": return "Ideias (capturada, não vira projeto)";
    case "aprendizado": return "Brain (aprendizado)";
    case "hipotese": return "Brain (hipótese)";
    case "decisao": return "Brain (decisão)";
    case "tarefa": return "Inbox (tarefa)";
    case "nota": return "Brain (nota)";
  }
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const has = (t: string, re: RegExp) => re.test(t);

// Sinais (texto já sem acento e minúsculo)
const RE = {
  despesa: /\b(gastei|paguei|comprei|torrei|investi|coloquei|saiu|custou|desembolsei)\b/,
  investimento: /\b(investi)\b/,
  receita: /\b(recebi|vendi|faturei|entrou|caiu|ganhei|fechei uma venda)\b/,
  evidencia: /\b(pediu|pediram|quer testar|querem testar|quer usar|interessad[oa]s?|fechou|fecharam|comprou|compraram|assinou|aceitou|gostou|gostaram|elogiou|reclamou|reclamaram|recusou|nao quis|disse que|respondeu)\b/,
  bloqueio: /\b(travei|travado|travada|bloquead[oa]|nao consegui|deu erro|esta parado|parado por|esperando|empacou|empaquei)\b/,
  avanco: /\b(avancei|avancou|terminei|finalizei|conclui|fiz|implementei|publiquei|entreguei|lancei|falei com|liguei|mandei|enviei|apresentei|testei|corrigi|subi|configurei|gravei|criei|montei|conversei|visitei|atendi|resolvi o|resolvi a)\b/,
  ideia: /\b(tive uma ideia|ideia de|ideia nova|pensei em (criar|abrir|vender|fazer|montar|revender|comecar)|e se eu)\b/,
  aprendizado: /\b(aprendi|percebi|descobri|entendi|licao|aprendizado|nao funciona|nao funcionou|funcionou)\b/,
  hipotese: /\b(acho que|parece que|talvez|desconfio|provavelmente|pode ser que)\b/,
  decisao: /\b(decidi|vou parar|nao vou|nao quero comecar|nao quero isso agora|resolvi nao|optei|deixar para depois|deixar pra depois)\b/,
  tarefa: /\b(preciso|tenho que|amanha vou|amanha preciso|falta|lembrar de|nao posso esquecer)\b/,
};

const CATEGORY: [RegExp, string][] = [
  [/\b(campanha|anuncio|ads|trafego|meta|facebook|instagram|criativo|google ads)\b/, "ads"],
  [/\b(ferramenta|assinatura|software|plano|hospedagem|dominio|app)\b/, "ferramentas"],
  [/\b(estoque|mercadoria|peca|pecas|produto para revenda)\b/, "estoque"],
  [/\b(gateway|taxa do|hotmart|kiwify|stripe|mercado pago)\b/, "gateway"],
  [/\b(faculdade|mensalidade|curso)\b/, "faculdade"],
];

export function categoryOf(text: string) {
  const t = fold(text);
  return CATEGORY.find(([re]) => re.test(t))?.[1] ?? "outros";
}

/** Valor em reais: "R$ 120", "120 reais", "R$1.250,50", "2 mil", "1,5 mil". */
export function parseAmount(text: string): number | null {
  const t = fold(text);
  const mil = t.match(/(\d+(?:[.,]\d+)?)\s*mil\b/);
  if (mil) return Math.round(Number(mil[1].replace(",", ".")) * 1000 * 100) / 100;
  const m = t.match(/r\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/) ?? t.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(reais|real|conto|pila)\b/);
  if (!m) return null;
  let s = m[1];
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const STOP = new Set(["projeto", "de", "do", "da", "dos", "das", "para", "com", "app", "the", "bolso"]);

/** Projeto citado: nome inteiro ou uma palavra marcante do nome (≥ 4 letras). */
export function findProject(text: string, projects: ProjectRef[]): ProjectRef | null {
  const t = ` ${fold(text).replace(/[^a-z0-9]+/g, " ")} `;
  let best: { p: ProjectRef; score: number } | null = null;
  for (const p of projects) {
    const name = fold(p.name).replace(/[^a-z0-9]+/g, " ").trim();
    if (!name) continue;
    if (t.includes(` ${name} `)) { const sc = 100 + name.length; if (!best || sc > best.score) best = { p, score: sc }; continue; }
    for (const w of name.split(" ")) {
      if (w.length >= 4 && !STOP.has(w) && t.includes(` ${w} `)) { if (!best || w.length > best.score) best = { p, score: w.length }; }
    }
  }
  return best?.p ?? null;
}

function cleanClause(s: string) {
  return s.replace(/^\s*(e também|e tambem|também|tambem|e|mas|então|entao|aí|ai|daí|dai|hoje|ontem)\s+/i, "").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
}
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Quebra em frases e depois em orações ("," " e " " mas " " também "). */
export function splitClauses(text: string): string[] {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?;])\s+|\n+/);
  const out: string[] = [];
  for (const s of sentences) {
    for (const part of s.split(/,\s+|\s+e\s+(?=[a-zà-ú])|\s+mas\s+|\s+também\s+|\s+tambem\s+/i)) {
      const c = cleanClause(part.replace(/[.!?;]+$/, ""));
      if (c) out.push(c);
    }
    out.push("§"); // fim de frase
  }
  return out;
}

function classify(clause: string): { kind: CaptureKind; signal: string } | null {
  const t = fold(clause);
  const amount = parseAmount(clause);
  if (amount && has(t, RE.receita)) return { kind: "receita", signal: "verbo de entrada + valor" };
  if (amount && has(t, RE.despesa)) return { kind: "despesa", signal: "verbo de gasto + valor" };
  if (has(t, RE.ideia)) return { kind: "ideia", signal: "“ideia”" };
  if (has(t, RE.decisao)) return { kind: "decisao", signal: "decisão explícita" };
  if (has(t, RE.evidencia)) return { kind: "evidencia", signal: "reação de cliente/usuário" };
  if (has(t, RE.bloqueio)) return { kind: "bloqueio", signal: "travou / não conseguiu" };
  // "não fiz nada", "não avancei": negação não é avanço.
  if (has(t, RE.avanco) && !/\bnao (\w+ )?(fiz|avancei|terminei|finalizei|mexi|liguei|mandei|testei|conclui|implementei|entreguei)\b/.test(t)) return { kind: "avanco", signal: "verbo de execução" };
  if (has(t, RE.aprendizado)) return { kind: "aprendizado", signal: "“aprendi/percebi”" };
  if (has(t, RE.hipotese)) return { kind: "hipotese", signal: "“acho que”" };
  if (has(t, RE.tarefa)) return { kind: "tarefa", signal: "“preciso/tenho que”" };
  if ((has(t, RE.despesa) || has(t, RE.receita)) && !amount) return { kind: has(t, RE.receita) ? "receita" : "despesa", signal: "dinheiro sem valor dito" };
  return null;
}

function ideaTitle(clause: string) {
  const m = clause.match(/(?:ideia (?:nova )?de|pensei em|e se eu)\s+(.+)/i);
  return cap((m?.[1] ?? clause).trim());
}

/**
 * Regras:
 * - "Atualiza o X: ..." define X como projeto da captura.
 * - Projeto citado vale para a frase e passa para a frase seguinte se ela não citar outro.
 * - Oração sem sinal é juntada ao item anterior; se não houver item, vira nota.
 * - "não quero começar isso agora" depois de uma ideia vira observação sobre a ideia.
 */
export function interpretRules(raw: string, projects: ProjectRef[], defaultProjectId: string | null = null): CaptureItem[] {
  let text = raw.trim();
  let forced: ProjectRef | null = defaultProjectId ? projects.find((p) => p.id === defaultProjectId) ?? null : null;
  const prefix = text.match(/^\s*(?:atualiza(?:r|cao|ção)?|update|sobre)\s+(?:o |a |do |da )?([^:–-]{2,40})[:–-]\s*/i);
  if (prefix) {
    const p = findProject(prefix[1], projects);
    if (p) { forced = p; text = text.slice(prefix[0].length); }
  }

  const items: CaptureItem[] = [];
  let sentenceProject: ProjectRef | null = null;
  let carried: ProjectRef | null = forced;
  let n = 0;
  const newId = () => `c${++n}`;

  for (const clause of splitClauses(text)) {
    if (clause === "§") { if (sentenceProject) carried = sentenceProject; sentenceProject = null; continue; }
    const mentioned = findProject(clause, projects);
    if (mentioned) sentenceProject = mentioned;
    const project = mentioned ?? sentenceProject ?? carried ?? forced;
    const c = classify(clause);
    const prev = items[items.length - 1];

    if (!c) {
      if (prev) { prev.text = `${prev.text}, ${clause}`; if (!prev.projectId && mentioned) prev.projectId = mentioned.id; }
      else items.push({ id: newId(), kind: "nota", text: cap(clause), projectId: mentioned?.id ?? forced?.id ?? null, amount: null, confidence: "baixa", why: "sem sinal claro; revise o tipo" });
      continue;
    }

    if (c.kind === "decisao" && prev?.kind === "ideia" && /\b(isso|essa|esse|agora)\b/.test(fold(clause))) {
      items.push({ id: newId(), kind: "decisao", text: `Não começar agora: ${prev.text}`, projectId: null, amount: null, confidence: "media", why: "decisão sobre a ideia anterior" });
      continue;
    }

    const projectKinds: CaptureKind[] = ["avanco", "evidencia", "bloqueio", "despesa", "receita", "aprendizado", "hipotese", "tarefa"];
    const pid = projectKinds.includes(c.kind) ? project?.id ?? null : null;
    const amount = c.kind === "despesa" || c.kind === "receita" ? parseAmount(clause) : null;
    const strong = (pid && ["avanco", "evidencia", "bloqueio"].includes(c.kind)) || amount !== null || c.kind === "ideia";
    items.push({
      id: newId(),
      kind: c.kind,
      text: c.kind === "ideia" ? ideaTitle(clause) : cap(clause),
      projectId: pid,
      amount,
      confidence: strong ? "alta" : "media",
      why: [c.signal, pid ? `projeto ${projects.find((p) => p.id === pid)?.name}${mentioned ? " (citado)" : " (do contexto)"}` : null].filter(Boolean).join(" · "),
    });
  }
  return items;
}

/** Sugestão de destino para um item solto da Inbox. */
export function suggestFor(text: string, projects: ProjectRef[]) {
  const items = interpretRules(text, projects);
  const first = items.find((i) => i.kind !== "nota") ?? items[0] ?? null;
  return first;
}

/** Projetos que o texto diz ter avançado (usado para cruzar check-in com atualizações registradas). */
export function claimedProgress(text: string, projects: ProjectRef[]): string[] {
  const ids = interpretRules(text, projects)
    .filter((i) => (i.kind === "avanco" || i.kind === "evidencia") && i.projectId)
    .map((i) => i.projectId as string);
  return [...new Set(ids)];
}
