"use client";

import { useActionState } from "react";
import { ErrorNote, Field, Input, Select, Textarea } from "@/components/ui";
import { Submit } from "@/components/submit";
import { PROJECT_STATUS_LABEL, type Project } from "@/lib/types";
import { createProject, updateProject, type ProjectState } from "./actions";

export function ProjectForm({ project }: { project?: Project }) {
  const [state, action] = useActionState<ProjectState, FormData>(project ? updateProject : createProject, {});
  return (
    <form action={action} className="space-y-4">
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      <Field label="Nome"><Input name="name" defaultValue={project?.name} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Estado">
          <Select name="status" defaultValue={project?.status ?? "construcao"}>
            {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Prioridade">
          <Select name="priority" defaultValue={String(project?.priority ?? 2)}>
            <option value="1">Alta</option><option value="2">Média</option><option value="3">Baixa</option>
          </Select>
        </Field>
      </div>
      <Field label="Próxima ação" hint="Passo concreto e executável. Ex.: Ligar para 3 oficinas e validar o fluxo de orçamento.">
        <Input name="next_action" defaultValue={project?.next_action ?? ""} maxLength={300} />
      </Field>
      <Field label="Prazo" hint="Opcional. Prazo próximo pesa no score.">
        <Input name="deadline" type="date" defaultValue={project?.deadline ?? ""} />
      </Field>
      <Field label="Próxima prova" hint="Fato observável. Ex.: 1 oficina usando o cadastro de cliente por 7 dias.">
        <Input name="next_proof" defaultValue={project?.next_proof ?? ""} />
      </Field>
      <Field label="Bloqueio atual"><Input name="blocker" defaultValue={project?.blocker ?? ""} /></Field>
      <Field label="Objetivo"><Textarea name="objective" rows={2} defaultValue={project?.objective ?? ""} /></Field>
      <Field label="Próxima entrega"><Input name="next_delivery" defaultValue={project?.next_delivery ?? ""} /></Field>
      <Field label="Descrição"><Textarea name="description" rows={2} defaultValue={project?.description ?? ""} /></Field>
      <Field label="Hipóteses"><Textarea name="hypotheses" rows={2} defaultValue={project?.hypotheses ?? ""} /></Field>
      <Field label="Riscos"><Textarea name="risks" rows={2} defaultValue={project?.risks ?? ""} /></Field>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      <Submit>{project ? "Salvar alterações" : "Criar projeto"}</Submit>
    </form>
  );
}
