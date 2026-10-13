import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { DecisionForm } from "../decision-form";

export const metadata: Metadata = { title: "Nova decisão" };

export default async function NovaDecisao({ searchParams }: PageProps<"/decidir/nova">) {
  const { projeto } = await searchParams;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("projects").select("id, name").not("status", "eq", "encerrado").order("priority");
  return (
    <>
      <PageHeader title="Nova decisão" subtitle="Preencha o que souber. Campo vazio vira lacuna apontada, não problema." />
      <DecisionForm projects={data ?? []} defaultProject={typeof projeto === "string" ? projeto : null} />
    </>
  );
}
