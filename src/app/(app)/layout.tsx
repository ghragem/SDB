import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/supabase/server";
import { computeNotices } from "@/lib/notifications";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase } = await requireUser();
  const [{ data: profile }, notices, inbox] = await Promise.all([
    supabase.from("profiles").select("onboarded_at").maybeSingle(),
    computeNotices(supabase),
    supabase.from("inbox_items").select("id", { count: "exact", head: true }).eq("status", "pendente"),
  ]);
  if (!profile?.onboarded_at) redirect("/onboarding");
  return (
    <Shell noticeCount={notices.length} inboxCount={inbox.count ?? 0}>
      {children}
    </Shell>
  );
}
