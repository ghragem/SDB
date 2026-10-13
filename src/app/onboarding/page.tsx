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
    <main className="pt-safe mx-auto min-h-dvh max-w-xl px-5 py-8 sm:py-14">
      <OnboardingFlow name={data?.display_name ?? null} />
    </main>
  );
}
