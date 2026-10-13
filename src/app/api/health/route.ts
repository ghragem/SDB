import { NextResponse } from "next/server";
import { rawEnvReport, supabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

// Diagnóstico público do deploy. Só mostra dados que já são públicos (host e início da chave publicável).
export async function GET() {
  const env = supabaseEnv();
  const bruto = rawEnvReport();
  if (!env) return NextResponse.json({ ok: false, problema: "variaveis_ausentes", bruto }, { status: 500 });
  let host = "";
  try { host = new URL(env.url).host; } catch { return NextResponse.json({ ok: false, problema: "url_invalida", bruto }, { status: 500 }); }
  let auth: number | null = null;
  let erro: string | null = null;
  try {
    const r = await fetch(`${env.url}/auth/v1/settings`, { headers: { apikey: env.key }, cache: "no-store" });
    auth = r.status;
  } catch (e) {
    const err = e as Error & { cause?: { message?: string; code?: string } };
    erro = [err.name, err.message, err.cause?.code, err.cause?.message].filter(Boolean).join(" | ");
  }
  return NextResponse.json({
    ok: auth === 200,
    supabase_host: host,
    chave_tipo: env.key.startsWith("sb_publishable_") ? "publishable" : env.key.startsWith("eyJ") ? "anon_jwt" : "desconhecida",
    chave_inicio: env.key.slice(0, 18),
    chave_tamanho: env.key.length,
    auth_settings_status: auth,
    erro,
    bruto,
    regiao: process.env.VERCEL_REGION ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
