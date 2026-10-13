"use client";

import { useActionState, useState } from "react";
import { Button, ErrorNote, Field, Input, cx } from "@/components/ui";
import { signIn, signUp, type AuthState } from "./actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "entrar" ? inState : upState;
  const pending = mode === "entrar" ? inPending : upPending;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-surface-2 p-1 text-sm font-medium" role="tablist">
        {(["entrar", "criar"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={cx("h-9 rounded-md transition-colors", mode === m ? "bg-accent text-accent-fg" : "text-muted")}>
            {m === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>
      <form action={mode === "entrar" ? inAction : upAction} className="space-y-4">
        {mode === "criar" && (
          <Field label="Nome">
            <Input name="name" autoComplete="given-name" placeholder="Gustavo" />
          </Field>
        )}
        <Field label="E-mail">
          <Input name="email" type="email" autoComplete="email" inputMode="email" required />
        </Field>
        <Field label="Senha" hint={mode === "criar" ? "Mínimo de 8 caracteres." : undefined}>
          <Input name="password" type="password" autoComplete={mode === "entrar" ? "current-password" : "new-password"} required minLength={mode === "criar" ? 8 : undefined} />
        </Field>
        {notice && !state.error && !state.info ? <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">{notice}</p> : null}
        {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
        {state.info ? <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">{state.info}</p> : null}
        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
    </div>
  );
}
