// Anti-bullshit engine por regras (seções 36, 84). Só aponta lacunas reais no que foi registrado.
type D = Record<string, unknown>;

export function decisionFlags(d: D) {
  const flags: string[] = [];
  const empty = (k: string) => d[k] === null || d[k] === undefined || d[k] === "";
  const money = !empty("amount") && Number(d.amount) > 0;
  if (money && empty("max_loss")) flags.push("Envolve dinheiro e não tem perda máxima definida.");
  if (empty("evidence")) flags.push("Nenhuma evidência registrada. Hoje isso é suposição.");
  if (empty("assumptions")) flags.push("Suposições não escritas. Toda decisão tem alguma.");
  if (empty("alternatives")) flags.push("Nenhuma alternativa considerada.");
  if (empty("opportunity_cost")) flags.push("Custo de oportunidade não avaliado: o que você deixa de fazer?");
  if (d.reversibility === "irreversivel" && empty("premortem")) flags.push("Decisão irreversível sem pre-mortem.");
  if (empty("reversibility")) flags.push("Reversibilidade não informada.");
  if (empty("downside")) flags.push("Downside não descrito.");
  return flags;
}

/** Sugestão de veredito por regras. A IA ou o próprio Gustavo podem discordar. */
export function suggestVerdict(d: D): { verdict: string; reason: string } {
  const flags = decisionFlags(d);
  const money = Number(d.amount ?? 0) > 0;
  if (!d.evidence && (money || d.reversibility === "irreversivel"))
    return { verdict: "faltam_dados", reason: "Sem evidência registrada para algo que custa dinheiro ou não volta atrás." };
  if (money && !d.max_loss) return { verdict: "testar_pequeno", reason: "Defina perda máxima e teste com uma fração do valor antes de apostar tudo." };
  if (d.reversibility === "irreversivel" && flags.length >= 3) return { verdict: "esperar", reason: "Irreversível e com várias lacunas no cartão." };
  if (flags.length === 0) return { verdict: "fazer", reason: "Cartão completo. Ainda assim, registre a revisão." };
  return { verdict: "testar_pequeno", reason: `${flags.length} lacuna${flags.length === 1 ? "" : "s"} no cartão. Teste pequeno reduz o custo de errar.` };
}

export const VERDICT_LABEL: Record<string, string> = {
  fazer: "Fazer", testar_pequeno: "Testar pequeno", esperar: "Esperar", nao_fazer: "Não fazer", faltam_dados: "Faltam dados",
};
