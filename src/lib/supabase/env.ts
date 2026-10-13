// Lê a configuração pública do Supabase. As duas variáveis entram no build:
// se forem adicionadas na Vercel depois do deploy, é preciso fazer Redeploy.
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key || !/^https?:\/\/[^\s]+$/.test(url)) return null;
  return { url, key };
}

export const ENV_MISSING_MESSAGE =
  "Configuração incompleta no servidor: faltam NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Adicione na Vercel em Settings → Environment Variables e faça Redeploy.";
