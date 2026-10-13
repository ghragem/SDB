import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { aiStatus } from "@/lib/ai";
import { fmtDay } from "@/lib/format";
import { Card, PageHeader, Section } from "@/components/ui";
import { Importer, PendingExtraction } from "./importer";

export const metadata: Metadata = { title: "Importar" };

export default async function ImportarPage() {
  const { supabase } = await requireUser();
  const ai = aiStatus();
  const [jobs, pending] = await Promise.all([
    supabase.from("import_jobs").select("id, title, data, created_at").order("created_at", { ascending: false }).limit(5),
    ai.configured
      ? supabase.from("brain_notes").select("id, title").eq("kind", "conversa").is("metadata->>extracted_at", null).order("created_at", { ascending: false }).limit(60)
      : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <PageHeader title="Importar conversas"
        subtitle="Traga o que você conversou no ChatGPT ou no Claude. O sistema não tem acesso direto às suas contas: você exporta, ele lê." />
      <div className="space-y-9">
        <Importer aiConfigured={ai.configured} />

        {pending.data?.length ? (
          <Section title="Importadas, ainda sem extração">
            <PendingExtraction notes={pending.data.map((n) => ({ id: n.id, title: n.title ?? "Conversa" }))} />
          </Section>
        ) : null}

        {jobs.data?.length ? (
          <Section title="Importações anteriores">
            <Card className="divide-y divide-line text-sm">
              {jobs.data.map((j) => {
                const d = j.data as { inserted?: number; skipped?: number; file?: string | null };
                return (
                  <div key={j.id} className="flex justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0 truncate">{d.file ?? j.title}</span>
                    <span className="shrink-0 text-xs text-muted">{d.inserted ?? 0} novas{d.skipped ? ` · ${d.skipped} repetidas` : ""} · {fmtDay(j.created_at)}</span>
                  </div>
                );
              })}
            </Card>
          </Section>
        ) : null}
      </div>
    </>
  );
}
