import { NextResponse } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

// Diagnóstico público do deploy. Só mostra dados que já são públicos (host e início da chave publicável).
export async function GET() {
  const env = supabaseEnv();
  if (!env) return NextResponse.json({ ok: false, problema: "variaveis_ausentes" }, { status: 500 });
  let host = "";
  try { host = new URL(env.url).host; } catch { return NextResponse.json({ ok: false, problema: "url_invalida" }, { status: 500 }); }
  let auth: number | string;
  try {
    const r = await fetch(`${env.url}/auth/v1/settings`, { headers: { apikey: env.key }, cache: "no-store" });
    auth = r.status;
  } catch (e) {
    auth = "falhou: " + ((e as Error).cause as Error | undefined)?.message || (e as Error).message;
  }
  return NextResponse.json({
    ok: auth === 200,
    supabase_host: host,
    chave_tipo: env.key.startsWith("sb_publishable_") ? "publishable" : env.key.startsWith("eyJ") ? "anon_jwt" : "desconhecida",
    chave_inicio: env.key.slice(0, 18),
    auth_settings_status: auth,
  });
}
