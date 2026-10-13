import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "Novo projeto" };

export default function NovoProjeto() {
  return (
    <>
      <PageHeader title="Novo projeto" subtitle="Ideia nova não entra aqui direto. Ela passa por Ideias primeiro." />
      <ProjectForm />
    </>
  );
}
