import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { aiStatus } from "@/lib/ai";
import { fmtDay, fmtMoney, todaySP } from "@/lib/format";
import { VERDICT_LABEL } from "@/lib/checks";
import { Badge, Card, Empty, LinkButton, PageHeader, Section, cx } from "@/components/ui";
import { RealityCheckPanel } from "./panels";

export const metadata: Metadata = { title: "Decidir" };

export default async function DecidirPage() {
  const { supabase } = await requireUser();
  const today = todaySP();
  const [{ data }, exps] = await Promise.all([
    supabase.from("decisions").select("id, title, verdict, status, review_at, amount, against_recommendation, created_at").order("created_at", { ascending: false }),
    supabase.from("experiments").select("id, hypothesis, status, deadline, max_amount, decision_id").in("status", ["planejado", "rodando"]).order("created_at", { ascending: false }),
  ]);
  const decisions = data ?? [];
  const open = decisions.filter((d) => d.status === "aberta" || d.status === "decidida");
  const closed = decisions.filter((d) => d.status === "revisada" || d.status === "cancelada");
  const ai = aiStatus();

  return (
    <>
      <PageHeader title="Decidir" subtitle="Decisão relevante tem cartão, veredito e data de revisão." action={<LinkButton href="/decidir/nova" variant="primary" size="sm"><Plus size={15} /> Nova</LinkButton>} />
      <div className="space-y-8">
        <Section title="Pendentes">
          {open.length ? (
            <Card className="divide-y divide-line">
              {open.map((d) => {
                const due = d.review_at && d.review_at <= today;
                return (
                  <Link key={d.id} href={`/decidir/${d.id}`} className="block px-4 py-3.5 hover:bg-surface-2">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium">{d.title}</span>
                      {d.verdict ? <Badge>{VERDICT_LABEL[d.verdict]}</Badge> : <Badge tone="warn">sem veredito</Badge>}
                    </div>
                    <p className="mt-1 text-[13px] text-muted">
                      {d.amount ? `${fmtMoney(Number(d.amount))} · ` : ""}
                      {d.review_at ? <span className={cx(due && "text-accent")}>revisar {fmtDay(d.review_at)}{due ? " (hoje ou atrasada)" : ""}</span> : "sem data de revisão"}
                      {d.against_recommendation ? " · contra a recomendação" : ""}
                    </p>
                  </Link>
                );
              })}
            </Card>
          ) : (
            <Empty title="Nenhuma decisão registrada." action={<LinkButton href="/decidir/nova" variant="primary">Registrar primeira decisão</LinkButton>}>
              “Quero colocar R$ 2.000 numa campanha.” “Quero abandonar um projeto.” Coisas assim entram aqui antes de acontecer.
            </Empty>
          )}
        </Section>

        {exps.data?.length ? (
          <Section title="Experimentos rodando">
            <Card className="divide-y divide-line">
              {exps.data.map((e) => (
                <Link key={e.id} href={e.decision_id ? `/decidir/${e.decision_id}` : "/decidir"} className="block px-4 py-3 text-sm hover:bg-surface-2">
                  <span className="font-medium">{e.hypothesis}</span>
                  <span className={cx("mt-0.5 block text-muted", e.deadline && e.deadline < today && "text-accent")}>
                    {e.max_amount ? `limite ${fmtMoney(Number(e.max_amount))} · ` : ""}{e.deadline ? `prazo ${fmtDay(e.deadline)}` : "sem prazo"}
                  </span>
                </Link>
              ))}
            </Card>
          </Section>
        ) : null}

        <Section title="Eu estou viajando?">
          <Card className="p-4"><RealityCheckPanel aiConfigured={ai.configured} /></Card>
        </Section>

        {closed.length ? (
          <Section title="Revisadas">
            <Card className="divide-y divide-line">
              {closed.map((d) => (
                <Link key={d.id} href={`/decidir/${d.id}`} className="flex justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                  <span className="truncate">{d.title}</span><span className="shrink-0 text-muted">{fmtDay(d.created_at)}</span>
                </Link>
              ))}
            </Card>
          </Section>
        ) : null}
      </div>
    </>
  );
}
