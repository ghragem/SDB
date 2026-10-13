import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseEnv } from "./env";

export async function createClient() {
  // Sem configuração, um endereço inválido: as chamadas falham e o login mostra o motivo.
  const env = supabaseEnv() ?? { url: "http://supabase-nao-configurado.invalid", key: "ausente" };
  const cookieStore = await cookies();
  return createServerClient(
    env.url,
    env.key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component: o proxy já renova a sessão.
          }
        },
      },
    },
  );
}

/** Cliente + usuário autenticado. Redireciona para /login se não houver sessão. */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId, email: (data?.claims?.email as string | undefined) ?? null };
}
