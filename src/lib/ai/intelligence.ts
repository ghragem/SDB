import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { daysSince, todaySP } from "../format";
import type { SessionItem } from "../types";
import { getProvider } from ".";
import { AIError, generateJson, type AIProvider, type JsonSchema, type ProviderName } from "./provider";

// ---------------------------------------------------------------------------
// Intelligence Layer: um único núcleo com contexto persistente (seções 50–52, 84).
// ---------------------------------------------------------------------------

const REALITY: Record<string, string> = {
  suave: "Seja claro e respeitoso, aponte problemas com cuidado.",
  direto: "Seja direto. Aponte problemas sem rodeio.",
  muito_direto:
    "Seja muito direto. Diga 'isso não fecha', 'você não validou isso', 'você está confundindo atividade com progresso' quando for o caso.",
};

export function systemPrompt(realityLevel: string) {
  return [
    "Você é a inteligência do Saindo do Bairro, o sistema operacional pessoal do Gustavo (São Paulo, estudante de Gestão Comercial na FAC, trabalha no negócio familiar de ar-condicionado automotivo, cria muitos projetos digitais).",
    "Objetivo: melhorar a qualidade das próximas decisões dele. Não agradar.",
    "Regras absolutas:",
    "- Nada de positividade automática, elogio sem evidência, frase de coach ou motivação.",
    "- Nunca invente dado. Se não sabe: 'Não sei'. Se faltam dados: 'Evidência insuficiente'.",
    "- Separe fato de suposição. Não declare causalidade a partir de poucos registros.",
    "- Ataque ideia, lógica, decisão e execução. Nunca a dignidade da pessoa.",
    "- Não diagnostique saúde mental. Energia/foco/pressão são só sinais.",
    "- Faturamento não é lucro. Novidade não é oportunidade. Teste pequeno antes de apostar grande.",
    `Tom: ${REALITY[realityLevel] ?? REALITY.muito_direto}`,
    "Escreva em português do Brasil, frases curtas, sem emoji.",
  ].join("\n");
}

type Ctx = { supabase: SupabaseClient; userId: string };

/** Seleção de contexto (seção 51): só o que é relevante, nunca o banco inteiro. */
export async function buildContext({ supabase }: Ctx, keys: string[]) {
  const parts: string[] = [];
  const want = (k: string) => keys.includes(k);

  if (want("profile")) {
    const { data } = await supabase.from("profiles").select("goals, skills_focus, recurring_problems").maybeSingle();
    if (data) parts.push(`PERFIL\nQuer melhorar: ${data.goals ?? "não informado"}\nHabilidades em foco: ${(data.skills_focus ?? []).join(", ") || "não informado"}\nProblemas recorrentes: ${data.recurring_problems ?? "não informado"}`);
  }
  if (want("active_projects")) {
    const { data } = await supabase
      .from("projects")
      .select("id, name, status, priority, next_proof, blocker, last_progress_at, created_at")
      .not("status", "in", "(pausado,encerrado,ideia)")
      .order("priority")
      .limit(8);
    parts.push(
      "PROJETOS ATIVOS\n" +
        ((data ?? []).map((p) => `- [${p.id}] ${p.name} | status ${p.status} | prioridade ${p.priority} | próxima prova: ${p.next_proof ?? "não definida"} | bloqueio: ${p.blocker ?? "nenhum registrado"} | dias sem avanço: ${daysSince(p.last_progress_at) ?? "nunca registrou"}`).join("\n") || "nenhum"),
    );
  }
  if (want("recent_checkins")) {
    const { data } = await supabase.from("daily_checkins").select("day, energy, focus, pressure, main_worry, raw_text, day_state").order("created_at", { ascending: false }).limit(5);
    parts.push("CHECK-INS RECENTES\n" + ((data ?? []).map((c) => `- ${c.day} | estado ${c.day_state} | E${c.energy ?? "?"} F${c.focus ?? "?"} P${c.pressure ?? "?"} | ${c.main_worry ?? ""} ${c.raw_text ? `| "${c.raw_text.slice(0, 280)}"` : ""}`).join("\n") || "nenhum"));
  }
  if (want("relevant_decisions")) {
    const { data } = await supabase.from("decisions").select("id, title, verdict, status, review_at, max_loss").neq("status", "revisada").order("created_at", { ascending: false }).limit(6);
    parts.push("DECISÕES ABERTAS\n" + ((data ?? []).map((d) => `- [${d.id}] ${d.title} | veredito ${d.verdict ?? "sem"} | revisar em ${d.review_at ?? "sem data"}`).join("\n") || "nenhuma"));
  }
  if (want("ideas")) {
    const { data } = await supabase.from("ideas").select("title, status, created_at").order("created_at", { ascending: false }).limit(8);
    parts.push("IDEIAS RECENTES\n" + ((data ?? []).map((i) => `- ${i.title} | ${i.status} | ${i.created_at.slice(0, 10)}`).join("\n") || "nenhuma"));
  }
  if (want("recent_failures")) {
    const { data } = await supabase.from("brain_notes").select("title, body, kind, created_at").in("kind", ["erro", "aprendizado", "regra"]).order("created_at", { ascending: false }).limit(6);
    parts.push("ERROS E APRENDIZADOS\n" + ((data ?? []).map((n) => `- (${n.kind}) ${n.title ?? ""} ${n.body.slice(0, 200)}`).join("\n") || "nenhum"));
  }
  if (want("rules")) {
    const { data } = await supabase.from("reality_rules").select("rule").eq("status", "active").order("position");
    parts.push("REGRAS QUE APRENDEMOS\n" + ((data ?? []).map((r) => `- ${r.rule}`).join("\n") || "nenhuma"));
  }
  if (want("financial_context")) {
    const since = todaySP().slice(0, 8) + "01";
    const { data } = await supabase.from("finance_transactions").select("type, amount").gte("occurred_on", since);
    const sum = (t: string) => (data ?? []).filter((x) => x.type === t).reduce((a, x) => a + Number(x.amount), 0);
    parts.push(data?.length ? `DINHEIRO NO MÊS (registrado manualmente)\nEntrou ${sum("receita").toFixed(2)} | Saiu ${sum("despesa").toFixed(2)} | Investido ${sum("investimento").toFixed(2)}` : "DINHEIRO NO MÊS\nnenhum lançamento registrado");
  }
  return parts.join("\n\n");
}

async function log(ctx: Ctx, p: AIProvider, task: string, input: string, output: string, keys: string[], status = "ok") {
  await ctx.supabase.from("ai_interactions").insert({
    user_id: ctx.userId,
    provider: p.name,
    model: p.model,
    task,
    input_summary: input.slice(0, 500),
    output: output.slice(0, 8000),
    context_keys: keys,
    status,
  });
}

async function realityLevel(ctx: Ctx) {
  const { data } = await ctx.supabase.from("preferences").select("reality_level, ai_provider").maybeSingle();
  return { level: data?.reality_level ?? "muito_direto", prefer: (data?.ai_provider ?? null) as ProviderName | null };
}

async function run<T>(ctx: Ctx, task: string, keys: string[], prompt: string, schema: JsonSchema): Promise<T | null> {
  const { level, prefer } = await realityLevel(ctx);
  const p = getProvider(prefer);
  if (!p) return null;
  const context = await buildContext(ctx, keys);
  const full = `CONTEXTO DO GUSTAVO (dados reais registrados no sistema)\n${context}\n\nTAREFA\n${prompt}`;
  try {
    const out = await generateJson<T>(p, { system: systemPrompt(level), prompt: full, schema });
    await log(ctx, p, task, prompt, JSON.stringify(out), keys);
    return out;
  } catch (e) {
    await log(ctx, p, task, prompt, e instanceof Error ? e.message : String(e), keys, "erro");
    throw e instanceof AIError ? e : new AIError("Falha na IA.", e);
  }
}

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

const str = { type: "string" };

export type AIDay = { reading: string; confidence: "alta" | "media" | "baixa"; items: SessionItem[] };

export async function aiDay(ctx: Ctx, checkinText: string, state: string, rulesDraft: { reading: string; items: SessionItem[] }) {
  const schema: JsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["reading", "confidence", "items"],
    properties: {
      reading: str,
      confidence: { type: "string", enum: ["alta", "media", "baixa"] },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "title", "detail", "minutes", "href", "ref_id"],
          properties: {
            kind: { type: "string", enum: ["projeto", "estudo", "falar", "decisao", "revisao", "escrever", "dinheiro"] },
            title: str,
            detail: str,
            minutes: { type: "integer" },
            href: { type: ["string", "null"] },
            ref_id: { type: ["string", "null"] },
          },
        },
      },
    },
  };
  const prompt = [
    `Check-in de hoje. Estado calculado: ${state}.`,
    `Relato: """${checkinText}"""`,
    "",
    "Rascunho do motor de regras (use como base, corrija se o contexto mostrar algo melhor):",
    JSON.stringify(rulesDraft),
    "",
    "Gere:",
    "- reading: leitura do dia em 2 a 4 frases curtas. Aponte dispersão, medo, novidade passando na frente de projeto. Sem conselho genérico.",
    "- items: de 2 a 4 itens (sobrevivência: no máximo 2, curtos). Mantenha href e ref_id dos itens do rascunho quando o item for o mesmo; para itens novos use href null e ref_id null.",
    "- confidence: baixa se houver poucos registros.",
  ].join("\n");
  return run<AIDay>(ctx, "leitura_do_dia", ["profile", "active_projects", "recent_checkins", "relevant_decisions", "ideas", "rules", "financial_context"], prompt, schema);
}

export type Adversarial = {
  against: string;
  for: string;
  facts: string[];
  uncertainties: string[];
  risks: string[];
  recommendation: string;
  verdict: "fazer" | "testar_pequeno" | "esperar" | "nao_fazer" | "faltam_dados";
  confidence: "alta" | "media" | "baixa";
};

export async function adversarialReview(ctx: Ctx, decisionText: string) {
  const list = { type: "array", items: str };
  const schema: JsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["against", "for", "facts", "uncertainties", "risks", "recommendation", "verdict", "confidence"],
    properties: {
      against: str, for: str, facts: list, uncertainties: list, risks: list, recommendation: str,
      verdict: { type: "string", enum: ["fazer", "testar_pequeno", "esperar", "nao_fazer", "faltam_dados"] },
      confidence: { type: "string", enum: ["alta", "media", "baixa"] },
    },
  };
  const prompt = [
    "Modo adversarial sobre a decisão abaixo.",
    "1) against: construa o MELHOR argumento contra (destrua a ideia).",
    "2) for: construa o MELHOR argumento a favor.",
    "3) Veredito: fatos (só o que está registrado), incertezas, riscos, recomendação objetiva e veredito.",
    "Antes de recomendar: que dados suportam? que viés pode existir? existe medo influenciando? qual o custo de oportunidade? o que mudaria a decisão?",
    "",
    decisionText,
  ].join("\n");
  return run<Adversarial>(ctx, "destrua_minha_ideia", ["profile", "active_projects", "relevant_decisions", "recent_failures", "rules", "financial_context"], prompt, schema);
}

export type RealityCheck = {
  fatos: string[]; suposicoes: string[]; emocoes: string[]; vieses: string[]; riscos: string[]; proxima_acao: string;
};

export async function realityCheck(ctx: Ctx, situation: string) {
  const list = { type: "array", items: str };
  const schema: JsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["fatos", "suposicoes", "emocoes", "vieses", "riscos", "proxima_acao"],
    properties: { fatos: list, suposicoes: list, emocoes: list, vieses: list, riscos: list, proxima_acao: str },
  };
  return run<RealityCheck>(
    ctx,
    "estou_viajando",
    ["profile", "active_projects", "recent_failures", "rules"],
    `"Eu estou viajando?" Separe a situação abaixo em fatos, suposições, emoções, vieses, riscos e uma próxima ação concreta.\n\n"""${situation}"""`,
    schema,
  );
}

export async function askHistory(ctx: Ctx, question: string, hits: { kind: string; title: string; snippet: string; created_at: string }[]) {
  const schema: JsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["answer", "confidence"],
    properties: { answer: str, confidence: { type: "string", enum: ["alta", "media", "baixa"] } },
  };
  const material = hits.map((h, i) => `[${i + 1}] (${h.kind}, ${h.created_at.slice(0, 10)}) ${h.title}: ${h.snippet}`).join("\n");
  return run<{ answer: string; confidence: string }>(
    ctx,
    "pergunte_ao_historico",
    ["active_projects"],
    `Pergunta do Gustavo sobre o próprio histórico: "${question}"\n\nRegistros encontrados na busca:\n${material || "nenhum"}\n\nResponda só com base nesses registros, citando [n]. Se não houver base, diga que não há registro suficiente.`,
    schema,
  );
}

export type Extracted = { kind: "ideia" | "decisao" | "tarefa" | "erro" | "aprendizado" | "oportunidade" | "nota"; text: string; projeto: string | null };

/** Importação: tira de uma conversa externa o que importa para o sistema. Vai para a Inbox, nunca direto. */
export async function extractFromConversation(ctx: Ctx, title: string, userText: string) {
  const schema: JsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["itens"],
    properties: {
      itens: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "text", "projeto"],
          properties: {
            kind: { type: "string", enum: ["ideia", "decisao", "tarefa", "erro", "aprendizado", "oportunidade", "nota"] },
            text: str,
            projeto: { type: ["string", "null"] },
          },
        },
      },
    },
  };
  return run<{ itens: Extracted[] }>(
    ctx,
    "importar_conversa",
    ["active_projects", "ideas"],
    `Conversa importada de outra IA, título "${title}". Abaixo, só o que o Gustavo escreveu nela.\n\n${userText}\n\n` +
      "Extraia no máximo 8 itens que valem entrar no sistema: ideias, decisões tomadas ou pendentes, tarefas concretas, erros, aprendizados, oportunidades. " +
      "Cada text em uma frase autossuficiente, em português, sem inventar nada que não esteja na conversa. " +
      "Em projeto, o nome de um projeto ativo do contexto quando o item claramente pertence a ele; senão null. " +
      "Se a conversa não tiver nada útil (ex.: dúvida pontual), devolva itens vazio.",
    schema,
  );
}

export type SpeechFeedback = { nota: number; problemas: string[]; ponto_forte: string; proximo_exercicio: string };

export async function speechFeedback(ctx: Ctx, prompt: string, transcript: string, metrics: string) {
  const schema: JsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["nota", "problemas", "ponto_forte", "proximo_exercicio"],
    properties: { nota: { type: "number" }, problemas: { type: "array", items: str }, ponto_forte: str, proximo_exercicio: str },
  };
  return run<SpeechFeedback>(
    ctx,
    "oratoria",
    ["active_projects"],
    `Avalie a fala do Gustavo (transcrição automática, pode ter erros de reconhecimento; não penalize pontuação).\nExercício: ${prompt}\nMétricas objetivas medidas: ${metrics}\nTranscrição: """${transcript}"""\n\nAvalie clareza, estrutura, chegada ao ponto, foco no problema do ouvinte, conclusão e prolixidade. nota de 0 a 10 com uma casa decimal. problemas: no máximo 4, concretos. proximo_exercicio: uma instrução curta e mensurável.`,
    schema,
  );
}
