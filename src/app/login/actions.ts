"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ENV_MISSING_MESSAGE, supabaseEnv } from "@/lib/supabase/env";

export type AuthState = { error?: string; info?: string };

function friendly(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. O link está na sua caixa de entrada.";
  if (m.includes("already registered")) return "Esse e-mail já tem conta. Use Entrar.";
  if (m.includes("password")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("rate limit")) return "Muitas tentativas. Espere alguns minutos e tente de novo.";
  if (m.includes("fetch failed") || m.includes("enotfound") || m.includes("network")) return "O servidor não conseguiu falar com o Supabase. Confira NEXT_PUBLIC_SUPABASE_URL na Vercel e faça Redeploy.";
  if (m.includes("invalid api key") || m.includes("no api key")) return "A chave do Supabase na Vercel está errada. Confira NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e faça Redeploy.";
  return "Não consegui concluir. Tente de novo.";
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Preencha e-mail e senha." };
  if (!supabaseEnv()) return { error: ENV_MISSING_MESSAGE };
  const supabase = await createClient();
  let message: string | null = null;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) message = error.message;
  } catch (e) {
    message = (e as Error).message || "fetch failed";
  }
  if (message) {
    console.error("[login] falhou:", message);
    return { error: friendly(message) };
  }
  redirect("/hoje");
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!email || !password) return { error: "Preencha e-mail e senha." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (!supabaseEnv()) return { error: ENV_MISSING_MESSAGE };
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name || null }, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: friendly(error.message) };
  if (data.session) redirect("/onboarding");
  return { info: `Enviei um link de confirmação para ${email}. Abra no mesmo aparelho para entrar.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
