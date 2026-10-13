import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Wordmark } from "@/components/shell";
import { ErrorNote } from "@/components/ui";
import { ENV_MISSING_MESSAGE, supabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  link: "Esse link não funcionou neste aparelho. Se você já confirmou o e-mail, entre com e-mail e senha.",
  confirmado: "E-mail confirmado. Entre com e-mail e senha.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { aviso } = await searchParams;
  const notice = typeof aviso === "string" ? NOTICES[aviso] : undefined;
  return (
    <main className="pt-page flex min-h-dvh flex-col justify-between px-6 pb-10 sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-sm">
        <div className="mb-10">
          <Wordmark />
          <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-tight">
            Pensar melhor.<br />Decidir melhor.<br />Executar melhor.
          </h1>
        </div>
        {!supabaseEnv() ? <div className="mb-4"><ErrorNote>{ENV_MISSING_MESSAGE}</ErrorNote></div> : null}
        <LoginForm notice={notice} />
      </div>
      <p className="mt-10 text-xs text-faint sm:text-center">Seus dados são privados e exigem login.</p>
    </main>
  );
}
