import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/supabase/server";
import { computeNotices } from "@/lib/notifications";
import { todaySP } from "@/lib/format";
import type { DayState } from "@/lib/types";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase } = await requireUser();
  const [{ data: profile }, notices, inbox, checkin] = await Promise.all([
    supabase.from("profiles").select("onboarded_at, display_name").maybeSingle(),
    computeNotices(supabase),
    supabase.from("inbox_items").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("daily_checkins").select("day_state").eq("day", todaySP()).order("created_at", { ascending: false }).limit(1),
  ]);
  if (!profile?.onboarded_at) redirect("/onboarding");
  return (
    <Shell noticeCount={notices.length} inboxCount={inbox.count ?? 0} name={profile.display_name || "Gustavo"}
      dayState={(checkin.data?.[0]?.day_state as DayState | undefined) ?? null}>
      {children}
    </Shell>
  );
}
