import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { computeNotices } from "@/lib/notifications";
import { Card, Empty, PageHeader, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificacoesPage() {
  const { supabase } = await requireUser();
  const notices = await computeNotices(supabase);
  return (
    <>
      <PageHeader title="Notificações" subtitle="Só o que pede ação. Calculado dos seus registros." />
      {notices.length ? (
        <Card className="divide-y divide-line">
          {notices.map((n) => (
            <Link key={n.key} href={n.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
              <span className={cx("h-2 w-2 shrink-0 rounded-full", n.tone === "accent" ? "bg-accent" : "bg-line-strong")} />
              <span className="flex-1">{n.body}</span>
              <ArrowUpRight size={16} className="shrink-0 text-faint" />
            </Link>
          ))}
        </Card>
      ) : (
        <Empty title="Nada pedindo ação agora." />
      )}
    </>
  );
}
