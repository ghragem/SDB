import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { OnboardingFlow } from "./flow";

export const metadata: Metadata = { title: "Começar" };

export default async function OnboardingPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("profiles").select("onboarded_at, display_name").maybeSingle();
  if (data?.onboarded_at) redirect("/hoje");
  return (
    <main className="pt-page mx-auto min-h-dvh max-w-xl px-5 pb-8 sm:pb-14">
      <OnboardingFlow name={data?.display_name ?? null} />
    </main>
  );
}
