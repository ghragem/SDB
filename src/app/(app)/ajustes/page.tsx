import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { aiStatus } from "@/lib/ai";
import { Badge, Button, Card, Field, Input, PageHeader, Section, Select } from "@/components/ui";
import { Submit } from "@/components/submit";
import { signOut } from "@/app/login/actions";
import { saveSettings } from "./actions";

export const metadata: Metadata = { title: "Ajustes" };

const INTEGRATIONS = ["Google Calendar", "Google Drive", "Gmail", "Meta Ads", "WhatsApp", "Gateways de pagamento", "Open Finance", "Marketplaces", "YouTube", "Importar conversa (ChatGPT/Claude)"];

export default async function AjustesPage() {
  const { supabase, email } = await requireUser();
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("display_name").maybeSingle(),
    supabase.from("preferences").select("reality_level, ai_provider").maybeSingle(),
  ]);
  const ai = aiStatus(prefs?.ai_provider as "anthropic" | "openai" | null);
  const hasA = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasO = Boolean(process.env.OPENAI_API_KEY);

  return (
    <>
      <PageHeader title="Ajustes" subtitle={email ?? undefined} />
      <div className="space-y-9">
        <Card className="p-4">
          <form action={saveSettings} className="space-y-4">
            <Field label="Nome"><Input name="display_name" defaultValue={profile?.display_name ?? ""} /></Field>
            <Field label="Modo realidade" hint="Quão direto o sistema é ao apontar problema.">
              <Select name="reality_level" defaultValue={prefs?.reality_level ?? "muito_direto"}>
                <option value="suave">Suave</option><option value="direto">Direto</option><option value="muito_direto">Muito direto</option>
              </Select>
            </Field>
            <Field label="Provider de IA preferido">
              <Select name="ai_provider" defaultValue={prefs?.ai_provider ?? ""}>
                <option value="">Automático</option>
                <option value="anthropic" disabled={!hasA}>Claude (Anthropic){hasA ? "" : " · sem chave"}</option>
                <option value="openai" disabled={!hasO}>OpenAI{hasO ? "" : " · sem chave"}</option>
              </Select>
            </Field>
            <Submit>Salvar</Submit>
          </form>
        </Card>

        <Section title="Inteligência">
          <Card className="divide-y divide-line text-sm">
            <Row label="IA de texto" state={ai.configured ? "CONECTADO" : "NÃO CONECTADO"} detail={ai.configured ? `${ai.provider} · ${ai.model}` : "Sem chave no servidor. Leitura do dia e sessão funcionam por regras."} />
            <Row label="Transcrição no servidor" state={ai.transcription ? "CONECTADO" : "NÃO CONECTADO"} detail={ai.transcription ? "OpenAI" : "Usando o reconhecimento de voz do navegador."} />
          </Card>
          <p className="text-xs text-faint">O contexto fica no banco do Saindo do Bairro. Os modelos só consultam. Trocar de provider não perde nada.</p>
        </Section>

        <Section title="Integrações">
          <Card className="divide-y divide-line text-sm">
            {INTEGRATIONS.map((i) => <Row key={i} label={i} state="EM BREVE" />)}
          </Card>
        </Section>

        <form action={signOut}>
          <Button type="submit" className="w-full">Sair</Button>
        </form>
      </div>
    </>
  );
}

function Row({ label, state, detail }: { label: string; state: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div>
        <p>{label}</p>
        {detail ? <p className="text-xs text-muted">{detail}</p> : null}
      </div>
      <Badge tone={state === "CONECTADO" ? "ok" : "neutral"}>{state}</Badge>
    </div>
  );
}
