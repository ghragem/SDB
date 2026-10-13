import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="pt-safe flex min-h-dvh flex-col justify-between px-6 py-10 sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-sm">
        <div className="mb-10">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden />
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em]">Saindo do Bairro</span>
          </div>
          <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-tight">
            Pensar melhor.<br />Decidir melhor.<br />Executar melhor.
          </h1>
        </div>
        <LoginForm />
      </div>
      <p className="mt-10 text-xs text-faint sm:text-center">Seus dados são privados e exigem login.</p>
    </main>
  );
}
