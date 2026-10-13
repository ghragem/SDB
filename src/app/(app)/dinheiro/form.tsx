"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ErrorNote, Field, Input, Select, cx } from "@/components/ui";
import { Submit } from "@/components/submit";
import { addTransaction, type MoneyState } from "./actions";

const CATS: Record<string, string[]> = {
  receita: ["vendas", "servicos", "salario", "outros"],
  despesa: ["ads", "gateway", "ferramentas", "reembolso", "estoque", "faculdade", "lazer", "compras", "moradia", "transporte", "alimentacao", "outros"],
  investimento: ["patrimonio", "estoque", "ferramentas", "outros"],
};

export function MoneyForm({ projects, today, defaultProject }: { projects: { id: string; name: string }[]; today: string; defaultProject?: string | null }) {
  const [type, setType] = useState("despesa");
  const [state, action] = useActionState<MoneyState, FormData>(addTransaction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1 text-sm font-medium">
        {[["receita", "Receita"], ["despesa", "Despesa"], ["investimento", "Investimento"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setType(k)} aria-pressed={type === k}
            className={cx("h-9 rounded-md", type === k ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-muted")}>{l}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (R$)"><Input name="amount" inputMode="decimal" required placeholder="0,00" /></Field>
        <Field label="Data"><Input name="occurred_on" type="date" defaultValue={today} /></Field>
        <Field label="Categoria">
          <Select name="category" key={type} defaultValue={CATS[type][0]}>
            {CATS[type].map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Projeto">
          <Select name="project_id" defaultValue={defaultProject ?? ""}>
            <option value="">Pessoal / nenhum</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      </div>
      <Input name="description" placeholder="Descrição (opcional)" />
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <Submit>Registrar</Submit>
    </form>
  );
}
