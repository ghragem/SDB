import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { aiStatus } from "@/lib/ai";
import { fmtDay } from "@/lib/format";
import { Badge, Card, Empty, Field, Input, PageHeader, Section, Select, Textarea } from "@/components/ui";
import { Submit } from "@/components/submit";
import { AskHistory } from "./ask";
import { createNote, deleteNote } from "./actions";

export const metadata: Metadata = { title: "Brain" };

const KIND_LABEL: Record<string, string> = {
  nota: "Nota", insight: "Insight", erro: "Erro", aprendizado: "Aprendizado", decisao: "Decisão", ideia: "Ideia", pessoa: "Pessoa",
  referencia: "Referência", link: "Link", conversa: "Conversa", pesquisa: "Pesquisa", hipotese: "Hipótese", regra: "Regra",
};
const EP: Record<string, string> = { fato: "Fato", analise: "Análise", hipotese: "Hipótese", opiniao: "Opinião" };

async function searchAction(form: FormData) {
  "use server";
  const q = String(form.get("q") ?? "").trim();
  redirect(q ? `/brain?q=${encodeURIComponent(q)}` : "/brain");
}

export default async function BrainPage({ searchParams }: PageProps<"/brain">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const kind = typeof sp.tipo === "string" ? sp.tipo : "";
  const { supabase } = await requireUser();
  const ai = aiStatus();

  const [notes, hits, rules, projects] = await Promise.all([
    (kind ? supabase.from("brain_notes").select("*").eq("kind", kind) : supabase.from("brain_notes").select("*")).order("created_at", { ascending: false }).limit(60),
    q ? supabase.rpc("search_all", { q }) : Promise.resolve({ data: null }),
    supabase.from("reality_rules").select("id, rule, detail, origin").eq("status", "active").order("position"),
    supabase.from("projects").select("id, name").order("priority"),
  ]);

  return (
    <>
      <PageHeader title="Brain" subtitle="Decisões, erros, aprendizados e notas. Tudo pesquisável." />
      <div className="space-y-9">
        <Section title="Pergunte ao seu histórico">
          {ai.configured ? (
            <AskHistory aiConfigured q={q} />
          ) : (
            <form action={searchAction} className="flex gap-2">
              <input name="q" defaultValue={q} placeholder="margem, AutoFlow, campanha…" aria-label="Buscar no histórico"
                className="h-12 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 placeholder:text-faint focus:border-line-strong focus:outline-none" />
              <Submit className="h-12" pendingText="…">Buscar</Submit>
            </form>
          )}
          {q && hits.data ? (
            <Card className="divide-y divide-line">
              {(hits.data as { kind: string; id: string; title: string; snippet: string; href: string; created_at: string }[]).length ? (
                (hits.data as { kind: string; id: string; title: string; snippet: string; href: string; created_at: string }[]).map((h) => (
                  <a key={h.kind + h.id} href={h.href} className="block px-4 py-3 hover:bg-surface-2">
                    <span className="text-[11px] uppercase tracking-wider text-faint">{h.kind} · {fmtDay(h.created_at)}</span>
                    <span className="block font-medium">{h.title}</span>
                    {h.snippet ? <span className="line-clamp-2 text-sm text-muted">{h.snippet}</span> : null}
                  </a>
                ))
              ) : <p className="px-4 py-3 text-sm text-muted">Não encontrado nos seus registros.</p>}
            </Card>
          ) : null}
        </Section>

        <Section title="Registrar">
          <Card className="p-4">
            <form action={createNote} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo">
                  <Select name="kind" defaultValue="aprendizado">
                    {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </Field>
                <Field label="Natureza">
                  <Select name="epistemic" defaultValue="">
                    <option value="">—</option>
                    {Object.entries(EP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </Field>
              </div>
              <Input name="title" placeholder="Título (opcional)" />
              <Textarea name="body" rows={3} required placeholder="O que você aprendeu, errou ou percebeu." />
              <div className="grid grid-cols-2 gap-3">
                <Input name="url" type="url" placeholder="Link (opcional)" />
                <Select name="project_id" defaultValue="" aria-label="Projeto">
                  <option value="">Sem projeto</option>
                  {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <Submit size="sm">Salvar no Brain</Submit>
            </form>
          </Card>
        </Section>

        <Section title="Regras que aprendemos">
          <Card className="divide-y divide-line">
            {(rules.data ?? []).map((r) => (
              <div key={r.id} className="px-4 py-3">
                <p className="font-medium">{r.rule}</p>
                {r.detail ? <p className="text-sm text-muted">{r.detail}</p> : null}
                {r.origin === "experiencia" ? <p className="mt-1 text-[11px] uppercase tracking-wider text-faint">da experiência</p> : null}
              </div>
            ))}
          </Card>
        </Section>

        <Section title="Notas" action={
          <form className="flex" action="/brain">
            <select name="tipo" defaultValue={kind} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" aria-label="Filtrar por tipo">
              <option value="">Todas</option>
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="ml-1 h-9 rounded-lg px-2 text-sm text-muted">Filtrar</button>
          </form>
        }>
          {notes.data?.length ? (
            <div className="space-y-2">
              {notes.data.map((n) => (
                <Card key={n.id} id={n.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={n.kind === "erro" ? "accent" : "neutral"}>{KIND_LABEL[n.kind] ?? n.kind}</Badge>
                      {n.epistemic ? <Badge>{EP[n.epistemic]}</Badge> : null}
                      <span className="text-xs text-faint">{fmtDay(n.created_at)}</span>
                    </div>
                    <form action={deleteNote}>
                      <input type="hidden" name="id" value={n.id} />
                      <button className="text-xs text-faint hover:text-accent" aria-label="Apagar nota">Apagar</button>
                    </form>
                  </div>
                  {n.title ? <p className="mt-2 font-medium">{n.title}</p> : null}
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">{n.body}</p>
                  {n.url ? <a href={n.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-muted underline underline-offset-4">{n.url}</a> : null}
                </Card>
              ))}
            </div>
          ) : (
            <Empty title={kind ? "Nada deste tipo ainda." : "Brain vazio."}>Registre o primeiro aprendizado acima. Revisões de decisão e check-ins também alimentam a busca.</Empty>
          )}
        </Section>
      </div>
    </>
  );
}
