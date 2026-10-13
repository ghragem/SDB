import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { fmtDay } from "@/lib/format";
import type { SpeechMetrics } from "@/lib/speech";
import type { SpeechFeedback } from "@/lib/ai/intelligence";
import { Card, PageHeader, Section } from "@/components/ui";
import { Trainer } from "./trainer";

export const metadata: Metadata = { title: "Falar" };

type Data = { transcript: string; metrics: SpeechMetrics; feedback: SpeechFeedback | null };

export default async function FalarPage({ searchParams }: PageProps<"/falar">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const [{ data }, priority] = await Promise.all([
    supabase.from("speech_sessions").select("id, title, data, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("projects").select("name").in("status", ["construcao", "validacao", "operando", "escalando"]).order("priority").limit(1),
  ]);
  const sessions = (data ?? []).map((s) => ({ ...s, d: s.data as Data }));
  const last = sessions[0]?.d.metrics;
  const fallback = priority.data?.[0] ? `Explique ${priority.data[0].name} para um cliente em 60 segundos.` : "Explique o que você faz em 60 segundos.";
  const prompt = typeof sp.tema === "string" && sp.tema ? sp.tema : fallback;

  return (
    <>
      <PageHeader title="Falar" subtitle="Grave, ouça, compare. A nota pode cair. Isso é informação." />
      <div className="space-y-9">
        <Trainer initialPrompt={prompt} previous={last ? { wpm: last.wpm, fillersPerMin: last.fillersPerMin } : null} />
        {sessions.length ? (
          <Section title="Histórico">
            <Card className="divide-y divide-line">
              {sessions.map((s) => (
                <details key={s.id} className="px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{s.title}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {fmtDay(s.created_at)} · {s.d.metrics.durationSec}s · {s.d.metrics.fillersPerMin} vícios/min{s.d.feedback ? ` · ${s.d.feedback.nota.toFixed(1).replace(".", ",")}` : ""}
                    </span>
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{s.d.transcript}</p>
                </details>
              ))}
            </Card>
          </Section>
        ) : null}
      </div>
    </>
  );
}
