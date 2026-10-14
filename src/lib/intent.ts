// Intenção da pergunta ao SDB. Regras simples; o que não casa vira busca no histórico.
export type Intent = "agora" | "evitando" | "parado" | "dispersao" | "decisao" | "dinheiro" | "projeto" | "ideia" | "historico" | "busca";

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function detectIntent(q: string): Intent {
  const t = fold(q);
  if (/\b(aprendi|aprendizado|historico|o que eu sei|o que ja|quando eu|em que mes|mudei de ideia)\b/.test(t) || /\bsobre\b.+/.test(t) && /\b(aprendi|sei|registrei|pensava|acreditava)\b/.test(t)) return "historico";
  if (/\b(evitando|fugindo|enrolando|adiando|procrastin)/.test(t)) return "evitando";
  if (/\b(dispers|foco|muita coisa|abrindo|me perdendo|espalhad)/.test(t)) return "dispersao";
  if (/\b(dinheiro|grana|gasto|gastei|financ|caixa|lucro|receita|margem)/.test(t)) return "dinheiro";
  if (/\b(decis|decidir|exige decisao)/.test(t)) return "decisao";
  if (/\b(ideia|vale a pena comecar|comecar essa|comecar isso|novo projeto)/.test(t)) return "ideia";
  if (/\b(parad|sem avanco|travad|essa semana|esquecid)/.test(t)) return "parado";
  if (/\b(qual projeto|merece|atencao|prioridade|priorizar)/.test(t)) return "projeto";
  if (/\b(o que (eu )?(faco|fazer|deveria)|agora|proxim[ao] passo|por onde comeco)/.test(t)) return "agora";
  return "busca";
}

