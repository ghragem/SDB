import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { aiStatus } from "@/lib/ai";
import { fmtDay } from "@/lib/format";
import { Badge, Card, Empty, Field, Input, PageHeader, Section, Select, Textarea } from "@/components/ui";
import { Submit } from "@/components/submit";
import { AskSDB } from "@/components/ask-sdb";
import { createNote, deleteNote, linkNote, unlink } from "./actions";
import Link from "next/link";

const REL: Record<string, string> = { relacionado: "relacionado a", causou: "causou", levou_a: "levou a", contradiz: "contradiz", confirma: "confirma", aprendizado_de: "é aprendizado de" };
const REL_IN: Record<string, string> = { relacionado: "relacionado a", causou: "causado por", levou_a: "veio de", contradiz: "contradito por", confirma: "confirmado por", aprendizado_de: "gerou o aprendizado" };
const hrefOf = (key: string) => {
  const [k, id] = key.split(":");
  return k === "projeto" ? `/projetos/${id}` : k === "decisao" ? `/decidir/${id}` : k === "ideia" ? `/ideias?aberta=${id}#${id}` : `/brain?nota=${id}`;
};

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
  const one = typeof sp.nota === "string" && /^[0-9a-f-]{36}$/.test(sp.nota) ? sp.nota : null;
  const { supabase } = await requireUser();
  const ai = aiStatus();

  const [notes, hits, rules, projects] = await Promise.all([
    // Conversas importadas são longas: ficam fora da lista geral e só aparecem no filtro "Conversa".
    (one ? supabase.from("brain_notes").select("*").eq("id", one)
      : kind ? supabase.from("brain_notes").select("*").eq("kind", kind) : supabase.from("brain_notes").select("*").neq("kind", "conversa"))
      .order("created_at", { ascending: false }).limit(kind === "conversa" ? 25 : 60),
    q ? supabase.rpc("search_all", { q }) : Promise.resolve({ data: null }),
    supabase.from("reality_rules").select("id, rule, detail, origin").eq("status", "active").order("position"),
    supabase.from("projects").select("id, name").order("priority"),
  ]);
  // Relações entre registros (nos dois sentidos) e nomes dos alvos possíveis.
  const ids = (notes.data ?? []).map((n) => n.id);
  const [links, decisions, ideas, recentNotes] = await Promise.all([
    ids.length ? supabase.from("brain_links").select("*").or(`and(from_kind.eq.nota,from_id.in.(${ids.join(",")})),and(to_kind.eq.nota,to_id.in.(${ids.join(",")}))`) : Promise.resolve({ data: [] }),
    supabase.from("decisions").select("id, title").order("created_at", { ascending: false }).limit(30),
    supabase.from("ideas").select("id, title").order("created_at", { ascending: false }).limit(30),
    supabase.from("brain_notes").select("id, title, body, kind").neq("kind", "conversa").order("created_at", { ascending: false }).limit(40),
  ]);
  const label = new Map<string, string>();
  for (const p of projects.data ?? []) label.set(`projeto:${p.id}`, `Projeto · ${p.name}`);
  for (const d of decisions.data ?? []) label.set(`decisao:${d.id}`, `Decisão · ${d.title}`);
  for (const i of ideas.data ?? []) label.set(`ideia:${i.id}`, `Ideia · ${i.title}`);
  for (const n of [...(recentNotes.data ?? []), ...(notes.data ?? [])]) label.set(`nota:${n.id}`, `${KIND_LABEL[n.kind] ?? "Nota"} · ${(n.title || n.body).slice(0, 60)}`);
  const linksOf = (id: string) => ((links.data ?? []) as { id: string; from_kind: string; from_id: string; to_kind: string; to_id: string; relation: string }[])
    .filter((l) => (l.from_kind === "nota" && l.from_id === id) || (l.to_kind === "nota" && l.to_id === id))
    .map((l) => {
      const out = l.from_id === id;
      const other = out ? `${l.to_kind}:${l.to_id}` : `${l.from_kind}:${l.from_id}`;
      return { id: l.id, text: `${out ? REL[l.relation] : REL_IN[l.relation]} ${label.get(other) ?? "registro"}`, href: hrefOf(other) };
    });

  return (
    <>
      <PageHeader title="Brain" subtitle="Decisões, erros, aprendizados e notas. Tudo pesquisável."
        action={<a href="/importar" className="text-sm text-muted underline underline-offset-4 hover:text-ink">Importar conversas</a>} />
      <div className="space-y-9">
        <Section title="Pergunte ao seu histórico">
          <Card className="p-4">
            <AskSDB mode="historico" shortcuts={false} placeholder="O que aprendi sobre tráfego? O que eu pensava sobre o AutoFlow?" />
            <p className="mt-2 text-xs text-faint">{ai.configured ? "A IA lê só os registros encontrados e responde em ordem no tempo." : "Sem IA: busca por palavra nos seus registros, em ordem no tempo (primeiro e mais recente)."}</p>
          </Card>
          <form action={searchAction} className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Busca por palavra: margem, AutoFlow, campanha…" aria-label="Buscar no histórico"
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 placeholder:text-faint focus:border-line-strong focus:outline-none" />
            <Submit className="h-11" pendingText="…">Buscar</Submit>
          </form>
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
                  {n.kind === "conversa" ? (
                    <details className="mt-1" open={Boolean(one)}>
                      <summary className="cursor-pointer text-sm text-muted">
                        {n.source === "chatgpt" ? "ChatGPT" : n.source === "claude" ? "Claude" : "Colada"} · {(n.metadata as { messages?: number }).messages ?? "?"} mensagens · ver conversa
                      </summary>
                      <p className="mt-2 max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-[14px] leading-relaxed text-muted">{n.body}</p>
                    </details>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">{n.body}</p>
                  )}
                  {n.url ? <a href={n.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-muted underline underline-offset-4">{n.url}</a> : null}
                  {linksOf(n.id).length ? (
                    <ul className="mt-2 space-y-1 text-[13px]">
                      {linksOf(n.id).map((l) => (
                        <li key={l.id} className="flex items-center gap-2">
                          <Link href={l.href} className="min-w-0 truncate text-muted hover:text-ink">↳ {l.text}</Link>
                          <form action={unlink}><input type="hidden" name="id" value={l.id} /><button className="text-[11px] text-faint hover:text-accent" aria-label="Remover relação">remover</button></form>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {n.kind !== "conversa" ? (
                    <details className="mt-2 text-[13px]">
                      <summary className="cursor-pointer text-faint">Relacionar</summary>
                      <form action={linkNote} className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input type="hidden" name="from_id" value={n.id} />
                        <select name="relation" defaultValue="relacionado" aria-label="Relação" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
                          {Object.entries(REL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select name="to" required defaultValue="" aria-label="Registro" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-sm">
                          <option value="" disabled>Escolha o registro…</option>
                          {[...label.entries()].filter(([k]) => k !== `nota:${n.id}`).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <button className="h-9 rounded-lg border border-line px-3 text-sm text-muted hover:text-ink">Ligar</button>
                      </form>
                    </details>
                  ) : null}
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
