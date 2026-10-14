import "server-only";
import { aiStatus } from "./ai";
import { answerWithFacts } from "./ai/intelligence";
import { addDays, todaySP } from "./format";
import { loadOperational } from "./operational";
import { createClient } from "./supabase/server";
import { DAY_STATE_LABEL } from "./types";
import { detectIntent, type Intent } from "./intent";
export type { Intent };

// SDB Copilot. Sem IA: identifica a intenção da pergunta e responde só com fatos do banco.
// Com IA: a IA recebe os mesmos fatos e redige; não recebe o banco inteiro e não pode inventar.

export type Fact = { text: string; href: string };
export type CopilotAnswer = { intent: Intent; answer: string; facts: Fact[]; source: "regras" | "ia"; note?: string | null };

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export async function askSDB(question: string, forced?: Intent): Promise<CopilotAnswer> {
  const q = question.trim().slice(0, 500);
  const intent = forced ?? detectIntent(q);
  const supabase = await createClient();
  const op = await loadOperational();
  const today = todaySP();
  const facts: Fact[] = [];
  const fact = (text: string, href: string) => { facts.push({ text, href }); return text; };
  const top = op.ranked[0] ?? null;
  let answer = "";

  if (intent === "agora" || intent === "decisao" || intent === "ideia") {
    if (op.mode) fact(`Modo do dia: ${DAY_STATE_LABEL[op.mode.state]} (${op.mode.reason})`, "/hoje");
    else fact("Sem check-in hoje: estado do dia desconhecido.", "/hoje");
  }

  if (intent === "agora") {
    const acts = op.actions.filter((a) => !a.done);
    acts.forEach((a) => fact(`Ação: ${a.label}${a.detail ? ` (${a.detail})` : ""}`, a.href));
    if (top) fact(`Prioridade #1: ${top.project.name}, score ${top.score} (${top.factors.filter((f) => f.points).map((f) => `${f.points > 0 ? "+" : ""}${f.points} ${f.label}`).join(", ")})`, `/projetos/${top.project.id}`);
    if (op.mode?.state === "sobrevivencia") {
      const big = op.queue.find((x) => (x.d.amount ?? 0) > 0 || x.d.reversibility === "irreversivel");
      answer = `Hoje está em Sobrevivência. Não abra projeto novo${big ? ` nem feche a decisão “${big.d.title}”` : " nem tome decisão grande"}. Faça só: ${acts[0]?.label ?? "a revisão do dia"} e encerre.`;
      if (big) fact(`Decisão aberta com dinheiro ou irreversível: ${big.d.title}`, `/decidir/${big.d.id}`);
    } else if (acts.length) {
      answer = `${op.mode ? "" : "Sem check-in, considerei um dia normal. "}Agora: ${acts[0].label}.${acts[1] ? ` Depois: ${acts[1].label}.` : ""}${top ? ` ${top.project.name} é a prioridade #1 (score ${top.score}).` : ""}`;
    } else answer = "Não há ação pendente registrada para hoje. Defina a próxima ação do projeto principal.";
  }

  else if (intent === "evitando") {
    const signals: string[] = [];
    const twoDays = new Date(Date.now() - 2 * 86_400_000).toISOString();
    for (const r of op.ranked) {
      const at = r.project.next_action_at;
      const last = r.project.last_progress_at ? new Date(r.project.last_progress_at).toISOString() : "";
      if (r.project.next_action && at && at < twoDays && last < at) {
        const days = Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000);
        signals.push(fact(`Você definiu “${r.project.next_action}” para ${r.project.name} há ${days} dias e não registrou avanço desde então.`, `/projetos/${r.project.id}`));
      }
    }
    for (const x of op.queue) {
      const age = Math.floor((Date.now() - new Date(x.d.created_at).getTime()) / 86_400_000);
      if (!x.d.verdict && age >= 5) signals.push(fact(`Decisão “${x.d.title}” aberta há ${age} dias sem veredito.`, `/decidir/${x.d.id}`));
    }
    const [{ count: oldIdeas }, { data: lastReview }] = await Promise.all([
      supabase.from("ideas").select("id", { count: "exact", head: true }).eq("status", "capturada").lte("created_at", addDays(today, -7)),
      supabase.from("daily_reviews").select("day").order("day", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (oldIdeas) signals.push(fact(`${oldIdeas} ideia(s) capturada(s) há mais de 7 dias sem análise.`, "/ideias"));
    if (lastReview?.day && lastReview.day < addDays(today, -2)) signals.push(fact(`Última revisão diária em ${ddmm(lastReview.day)}.`, "/review"));
    if (!lastReview) signals.push(fact("Nenhuma revisão diária registrada até hoje.", "/review"));
    answer = signals.length ? `Sinais de evitação nos seus registros: ${signals[0]}${signals.length > 1 ? ` E mais ${signals.length - 1}.` : ""}` : "Não encontrei sinal de evitação nos registros. Isso não prova que não exista, só que não está registrado.";
  }

  else if (intent === "parado") {
    const stale = op.ranked.filter((r) => r.idleDays >= 5);
    stale.forEach((r) => fact(`${r.project.name}: ${r.idleDays} dias sem avanço${r.neverProgressed ? " (desde o cadastro)" : ""}. Próxima ação: ${r.project.next_action ?? "não definida"}.`, `/projetos/${r.project.id}`));
    const weekStart = addDays(today, -6);
    const { data: wk } = await supabase.from("project_updates").select("project_id").eq("is_progress", true).gte("created_at", weekStart);
    const moved = new Set((wk ?? []).map((u) => u.project_id));
    const noWeek = op.ranked.filter((r) => !moved.has(r.project.id));
    if (noWeek.length) fact(`Sem avanço nos últimos 7 dias: ${noWeek.map((r) => r.project.name).join(", ")}.`, "/projetos");
    answer = stale.length ? `${stale.length === 1 ? "Um projeto ativo está parado" : `${stale.length} projetos ativos estão parados`}: ${stale.map((r) => `${r.project.name} (${r.idleDays} dias)`).join(", ")}. Continue, pause ou arquive em Projetos.`
      : noWeek.length ? `Nenhum projeto parado há 5+ dias, mas ${noWeek.map((r) => r.project.name).join(", ")} não teve avanço nos últimos 7 dias.` : "Nada parado: todos os projetos ativos tiveram avanço recente.";
  }

  else if (intent === "dispersao") {
    const keys = ["dispersao-ideias", "muitos-ativos"];
    const alerts = op.alerts.filter((a) => keys.includes(a.key) || a.key.startsWith("novo-"));
    alerts.forEach((a) => fact(a.text, a.href));
    const { count: ideas7 } = await supabase.from("ideas").select("id", { count: "exact", head: true }).gte("created_at", addDays(today, -7));
    fact(`${op.ranked.length} projetos ativos; ${ideas7 ?? 0} ideias criadas nos últimos 7 dias.`, "/projetos");
    answer = alerts.length ? `${alerts[0].text}${top ? ` Recomendação: não promover ideia nem abrir frente hoje; avance ${top.project.name}.` : ""}` : `Sem sinal de dispersão nos registros: ${op.ranked.length} projetos ativos e ${ideas7 ?? 0} ideias em 7 dias.`;
  }

  else if (intent === "decisao") {
    op.queue.slice(0, 4).forEach((x) => fact(`${x.d.title}: ${x.reason}${x.missing.length ? `; faltam ${x.missing.join(", ")}` : ""}.`, `/decidir/${x.d.id}`));
    op.risks.filter((r) => r.message).forEach((r) => fact(`${r.e.hypothesis}: ${r.message}`, "/decidir#risco"));
    answer = op.queue.length ? `Primeiro: “${op.queue[0].d.title}” (${op.queue[0].reason}).${op.queue.length > 1 ? ` Há mais ${op.queue.length - 1} na fila.` : ""}${op.mode?.state === "sobrevivencia" ? " Hoje é Sobrevivência: só decida o que for reversível." : ""}` : "Nenhuma decisão aberta registrada.";
  }

  else if (intent === "dinheiro") {
    const month = today.slice(0, 8) + "01";
    const [{ data: tx }, { data: projects }] = await Promise.all([
      supabase.from("finance_transactions").select("type, amount, category, project_id, occurred_on").gte("occurred_on", addDays(today, -90)),
      supabase.from("projects").select("id, name"),
    ]);
    const all = tx ?? [];
    const m = all.filter((t) => t.occurred_on >= month);
    const sum = (list: typeof all, k: string) => list.filter((t) => t.type === k).reduce((a, t) => a + Number(t.amount), 0);
    const inM = sum(m, "receita"), outM = sum(m, "despesa"), invM = sum(m, "investimento");
    if (!all.length) answer = "Não há lançamentos em Dinheiro nos últimos 90 dias. Sem isso não dá para dizer nada sobre seu dinheiro.";
    else {
      fact(`Mês: entrou ${brl(inM)}, saiu ${brl(outM)}, investido ${brl(invM)}, resultado ${brl(inM - outM - invM)}.`, "/dinheiro");
      const loose = m.filter((t) => t.type !== "receita" && !t.project_id);
      if (loose.length) fact(`${loose.length} gasto(s) do mês sem projeto: ${brl(loose.reduce((a, t) => a + Number(t.amount), 0))}.`, "/dinheiro");
      for (const p of projects ?? []) {
        const pr = all.filter((t) => t.project_id === p.id);
        if (!pr.length) continue;
        const rev = sum(pr, "receita"), cost = sum(pr, "despesa") + sum(pr, "investimento");
        fact(rev && !cost ? `${p.name}: receita ${brl(rev)} em 90 dias e nenhum custo registrado (margem desconhecida).` : `${p.name} (90 dias): receita ${brl(rev)}, custos ${brl(cost)}, resultado ${brl(rev - cost)}.`, `/projetos/${p.id}`);
      }
      answer = `Este mês: entrou ${brl(inM)}, saiu ${brl(outM + invM)}. Resultado ${brl(inM - outM - invM)}.${loose.length ? " Há gastos sem projeto: sem isso, a margem por projeto fica errada." : ""}`;
    }
  }

  else if (intent === "projeto") {
    op.ranked.slice(0, 3).forEach((r, i) => fact(`#${i + 1} ${r.project.name}: score ${r.score} (${r.factors.filter((f) => f.points).map((f) => `${f.points > 0 ? "+" : ""}${f.points} ${f.label}`).join(", ")})`, `/projetos/${r.project.id}`));
    answer = top ? `${top.project.name} (score ${top.score}). ${top.action.level === "ok" ? `Próxima ação: ${top.project.next_action}.` : "Ele não tem próxima ação concreta: defina antes de qualquer outra coisa."}` : "Nenhum projeto ativo cadastrado.";
  }

  else if (intent === "ideia") {
    const { count: ideas7 } = await supabase.from("ideas").select("id", { count: "exact", head: true }).gte("created_at", addDays(today, -7));
    if (top) fact(`Prioridade #1: ${top.project.name}, ${top.neverProgressed ? "sem avanço registrado" : `${top.idleDays} dias desde o último avanço`}, próxima prova: ${top.project.next_proof ?? "não definida"}.`, `/projetos/${top.project.id}`);
    fact(`${op.ranked.length} projetos ativos; ${ideas7 ?? 0} ideias nos últimos 7 dias.`, "/ideias");
    const room = top && top.idleDays <= 2 && op.ranked.length <= 2 && (ideas7 ?? 0) <= 1;
    answer = room
      ? "Os registros mostram espaço: o principal está andando e há poucas frentes. Registre a ideia em Ideias e responda as 7 perguntas antes de qualquer gasto. Teste pequeno, não projeto."
      : `Não começar agora. ${top ? `${top.project.name} ainda não fechou a próxima prova e ` : ""}há ${op.ranked.length} frentes ativas. Registre a ideia e diga por que ela merece passar na frente${top ? ` de ${top.project.name}` : ""}.`;
  }

  else {
    // Histórico e busca: Postgres full-text, em ordem cronológica (memória temporal).
    const topic = intent === "historico" ? (q.match(/sobre\s+(.+?)[?.!]*$/i)?.[1] ?? q) : q;
    const terms = fold(topic).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !["aprendi", "sobre", "ultimos", "meses", "historico", "registrei", "quando", "porque", "estou", "minha", "minhas", "meus"].includes(w));
    const query = terms.join(" or ");
    const { data } = query ? await supabase.rpc("search_all", { q: query }) : { data: [] };
    const hits = ((data ?? []) as { kind: string; title: string; snippet: string; href: string; created_at: string }[])
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    hits.slice(-8).forEach((h) => fact(`${MONTHS[+h.created_at.slice(5, 7) - 1]}/${h.created_at.slice(0, 4)} · ${h.kind}: ${h.title}${h.snippet ? ` — ${h.snippet.slice(0, 140)}` : ""}`, h.href));
    if (!hits.length) answer = terms.length ? `Não encontrei registros sobre “${terms.join(" ")}”. Faltam dados: registre aprendizados e decisões sobre isso para o sistema lembrar.` : "Não entendi o assunto. Pergunte com uma palavra-chave (ex.: “o que aprendi sobre tráfego?”).";
    else {
      const first = hits[0], last = hits[hits.length - 1];
      const when = (iso: string) => `${MONTHS[+iso.slice(5, 7) - 1]}/${iso.slice(0, 4)}`;
      answer = hits.length === 1 ? `Um registro, em ${when(first.created_at)}: ${first.title}.`
        : `${hits.length} registros. Em ${when(first.created_at)} você registrou: “${first.title}”. O mais recente, em ${when(last.created_at)}: “${last.title}”. Compare os dois para ver o que mudou.`;
    }
  }

  let source: "regras" | "ia" = "regras";
  let note: string | null = null;
  if (aiStatus().configured && facts.length) {
    try {
      const sb = await createClient();
      const { data: claims } = await sb.auth.getClaims();
      const out = await answerWithFacts({ supabase: sb, userId: claims?.claims?.sub as string }, q, facts.map((f) => f.text), answer);
      if (out?.answer) { answer = out.answer; source = "ia"; }
    } catch (e) {
      note = `IA indisponível (${e instanceof Error ? e.message : "erro"}). Resposta por regras.`;
    }
  }
  return { intent, answer, facts, source, note };
}
