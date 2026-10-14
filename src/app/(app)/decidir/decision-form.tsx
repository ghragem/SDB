"use client";

import { useActionState } from "react";
import { ErrorNote, Field, Input, Select, Textarea } from "@/components/ui";
import { Submit } from "@/components/submit";
import { createDecision, updateDecision, type DecisionState } from "./actions";

type D = Record<string, string | number | null>;

export function DecisionForm({ decision, projects, defaultProject }: { decision?: D; projects: { id: string; name: string }[]; defaultProject?: string | null }) {
  const [state, action] = useActionState<DecisionState, FormData>(decision ? updateDecision : createDecision, {});
  const v = (k: string) => (decision?.[k] ?? "") as string;
  return (
    <form action={action} className="space-y-4">
      {decision ? <input type="hidden" name="id" value={String(decision.id)} /> : null}
      <Field label="Decisão" hint="Uma frase. Ex.: Colocar R$ 2.000 numa campanha do Coach de Bolso.">
        <Input name="title" defaultValue={v("title")} required />
      </Field>
      <Field label="Projeto ligado">
        <Select name="project_id" defaultValue={v("project_id") || defaultProject || ""}>
          <option value="">Nenhum</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Objetivo"><Textarea name="objective" rows={2} defaultValue={v("objective")} /></Field>
        <Field label="Motivo" hint="Por que agora?"><Textarea name="motive" rows={2} defaultValue={v("motive")} /></Field>
        <Field label="Valor envolvido (R$)"><Input name="amount" inputMode="decimal" defaultValue={v("amount")} /></Field>
        <Field label="Perda máxima aceitável (R$)" help="O máximo que você aceita perder se der errado. Passou disso, para."><Input name="max_loss" inputMode="decimal" defaultValue={v("max_loss")} /></Field>
        <Field label="Upside" help="O melhor resultado realista se der certo."><Textarea name="upside" rows={2} defaultValue={v("upside")} /></Field>
        <Field label="Downside" help="O que acontece de pior se der errado."><Textarea name="downside" rows={2} defaultValue={v("downside")} /></Field>
        <Field label="Evidências" hint="Fatos e dados. Não opinião." help="O que você viu acontecer: números, conversas, testes. “Acho que” não conta."><Textarea name="evidence" rows={3} defaultValue={v("evidence")} /></Field>
        <Field label="Suposições" help="O que você está assumindo como verdade sem ter testado."><Textarea name="assumptions" rows={3} defaultValue={v("assumptions")} /></Field>
        <Field label="Reversibilidade" help="Se der errado, quão fácil é voltar atrás?">
          <Select name="reversibility" defaultValue={v("reversibility")}>
            <option value="">Não sei</option><option value="reversivel">Reversível</option><option value="parcial">Parcialmente</option><option value="irreversivel">Irreversível</option>
          </Select>
        </Field>
        <Field label="Prazo para decidir"><Input name="deadline" type="date" defaultValue={v("deadline")} /></Field>
        <Field label="Alternativas" help="Outros caminhos para o mesmo objetivo, incluindo não fazer nada."><Textarea name="alternatives" rows={2} defaultValue={v("alternatives")} /></Field>
        <Field label="Custo de oportunidade" help="O que você deixa de fazer ou financiar ao escolher isso."><Textarea name="opportunity_cost" rows={2} defaultValue={v("opportunity_cost")} /></Field>
      </div>
      <Field label="Pré-mortem" hint="Imagine que daqui a seis meses isso deu completamente errado. Por quê?" help="Imagine que a decisão deu completamente errado. Quais seriam as causas mais prováveis? Escrever antes ajuda a ver o risco que a empolgação esconde.">
        <Textarea name="premortem" rows={3} defaultValue={v("premortem")} />
      </Field>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <Submit>{decision ? "Salvar cartão" : "Registrar decisão"}</Submit>
    </form>
  );
}
