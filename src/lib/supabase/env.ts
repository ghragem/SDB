// Lê a configuração pública do Supabase. As duas variáveis entram no build:
// se forem adicionadas na Vercel depois do deploy, é preciso fazer Redeploy.
export function supabaseEnv(): { url: string; key: string } | null {
  // Remove espaços, quebras de linha, aspas e caracteres invisíveis que vêm junto ao colar no painel.
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, "");
  const key = clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!url || !key || !/^https?:\/\/[^\s]+$/.test(url)) return null;
  return { url, key };
}

export const ENV_MISSING_MESSAGE =
  "Configuração incompleta no servidor: faltam NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Adicione na Vercel em Settings → Environment Variables e faça Redeploy.";

function clean(v: string | undefined) {
  if (!v) return undefined;
  return v.replace(/[\s"'`\u200B-\u200D\uFEFF\u00A0]/g, "").replace(/[^\x21-\x7E]/g, "") || undefined;
}

/** Diagnóstico do valor cru (sem expor nada além do que já é público). */
export function rawEnvReport() {
  const raw = (v: string | undefined) => ({
    definida: v !== undefined,
    tamanho: v?.length ?? 0,
    caracteres_estranhos: v ? [...v].filter((c) => !/[\x21-\x7E]/.test(c)).map((c) => "U+" + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")) : [],
  });
  return { url: raw(process.env.NEXT_PUBLIC_SUPABASE_URL), chave: raw(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) };
}
