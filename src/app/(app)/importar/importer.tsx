"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { parseFile, parsePasted, toBody, type Conversation } from "@/lib/import/parse";
import { Badge, Button, Card, ErrorNote, Input, Textarea, cx } from "@/components/ui";
import { extractToInbox, finishImport, importBatch, type ImportItem } from "./actions";

type Saved = { id: string; title: string; extract?: "ok" | "erro" | "rodando"; count?: number; error?: string };
const BATCH_BYTES = 900_000;

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "sem data");

export function Importer({ aiConfigured }: { aiConfigured: boolean }) {
  const [tab, setTab] = useState<"arquivo" | "colar">("arquivo");
  const [file, setFile] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<"idle" | "lendo" | "salvando" | "pronto">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = [...convs].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return t ? list.filter((c) => c.title.toLowerCase().includes(t)) : list;
  }, [convs, q]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null); setSaved([]); setSkipped(0); setPhase("lendo"); setFile(f.name);
    try {
      const list = await parseFile(f);
      if (!list.length) throw new Error("Nenhuma conversa com texto encontrada nesse arquivo.");
      setConvs(list);
      setPicked(new Set(list.map((c) => c.externalId)));
      setPhase("idle");
    } catch (e) {
      setConvs([]); setPhase("idle");
      setError(e instanceof Error ? e.message : "Não consegui ler o arquivo.");
    }
  }

  async function save(list: Conversation[], source: string) {
    setError(null); setPhase("salvando"); setProgress(0);
    const items: ImportItem[] = list.map((c) => ({
      externalId: c.externalId, source: c.source, title: c.title, createdAt: c.createdAt, body: toBody(c), messageCount: c.messages.length,
    }));
    // Lotes por tamanho: o servidor aceita até 2 MB por chamada.
    const batches: ImportItem[][] = [];
    let cur: ImportItem[] = []; let size = 0;
    for (const it of items) {
      const s = it.body.length * 2 + 300;
      if (cur.length && (size + s > BATCH_BYTES || cur.length >= 50)) { batches.push(cur); cur = []; size = 0; }
      cur.push(it); size += s;
    }
    if (cur.length) batches.push(cur);

    const all: Saved[] = []; let skip = 0; let done = 0;
    for (const b of batches) {
      try {
        const r = await importBatch(b);
        all.push(...r.inserted); skip += r.skipped;
        if (r.error) setError(r.error);
      } catch {
        setError("A conexão caiu no meio da importação. Rode de novo: o que já foi salvo não duplica.");
        break;
      }
      done += b.length;
      setProgress(Math.round((done / items.length) * 100));
    }
    setSaved(all); setSkipped(skip); setPhase("pronto");
    await finishImport({ source, file, found: convs.length || list.length, selected: list.length, inserted: all.length, skipped: skip }).catch(() => {});
  }

  async function extract(ids: string[]) {
    for (const id of ids) {
      setSaved((s) => s.map((x) => (x.id === id ? { ...x, extract: "rodando" } : x)));
      const r = await extractToInbox(id).catch(() => ({ error: "Falha de conexão." } as { error: string; count?: number }));
      setSaved((s) => s.map((x) => (x.id === id ? { ...x, extract: r.error ? "erro" : "ok", count: r.count, error: r.error } : x)));
      if (r.error?.includes("Limite")) break; // plano gratuito: para e deixa o resto para depois
    }
  }

  const pickedList = convs.filter((c) => picked.has(c.externalId));
  const toggleAll = () => setPicked(picked.size === convs.length ? new Set() : new Set(convs.map((c) => c.externalId)));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1" role="tablist" aria-label="Forma de importar">
        {(["arquivo", "colar"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cx("h-9 rounded-md text-[13px] font-medium", tab === k ? "bg-accent text-accent-fg" : "text-muted hover:text-ink")}>
            {k === "arquivo" ? "Arquivo de exportação" : "Colar conversa"}
          </button>
        ))}
      </div>

      {tab === "arquivo" ? (
        <>
          <Card className="p-4 text-sm">
            <p className="font-medium">Como pegar o arquivo</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li><b className="text-ink">ChatGPT:</b> Configurações → Controles de dados → Exportar dados. Chega um e-mail com um .zip.</li>
              <li><b className="text-ink">Claude:</b> Settings → Privacy → Export data. Também chega um .zip por e-mail.</li>
              <li>Envie o .zip aqui. Ele é lido no seu aparelho; só as conversas que você marcar vão para o banco.</li>
            </ol>
          </Card>

          <input ref={inputRef} type="file" accept=".zip,.json,application/zip,application/json" className="hidden"
            onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={phase === "lendo" || phase === "salvando"}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center hover:bg-surface-2 disabled:opacity-60">
            <FileUp size={22} className="text-accent" />
            <span className="font-medium">{phase === "lendo" ? "Lendo o arquivo…" : file ? `Trocar arquivo (${file})` : "Escolher o .zip ou conversations.json"}</span>
            <span className="text-xs text-faint">Arquivos grandes podem levar alguns segundos.</span>
          </button>
        </>
      ) : (
        <Card className="space-y-3 p-4">
          <Input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="Título (ex.: Precificação do AutoFlow)" aria-label="Título" />
          <Textarea rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Cole a conversa ou um resumo. Linhas com \"Você:\" e \"ChatGPT:\" separam quem falou."} aria-label="Conversa" />
          <Button variant="primary" className="w-full" disabled={!pasteText.trim() || phase === "salvando"}
            onClick={() => { const c = parsePasted(pasteTitle, pasteText); setConvs([]); save([c], "texto").then(() => { setPasteText(""); setPasteTitle(""); }); }}>
            {phase === "salvando" ? "Salvando…" : "Salvar no Brain"}
          </Button>
        </Card>
      )}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {tab === "arquivo" && convs.length && phase !== "pronto" ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <span className="text-sm"><b>{convs.length}</b> conversas · <b>{picked.size}</b> marcadas</span>
            <button type="button" onClick={toggleAll} className="text-sm text-muted underline underline-offset-4">{picked.size === convs.length ? "Desmarcar todas" : "Marcar todas"}</button>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por título" aria-label="Filtrar" className="ml-auto h-9 w-full sm:w-56" />
          </div>
          <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto">
            {visible.map((c) => (
              <li key={c.externalId}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={picked.has(c.externalId)}
                    onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(c.externalId)) n.delete(c.externalId); else n.add(c.externalId); return n; })} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{c.title}</span>
                    <span className="text-xs text-faint">{fmt(c.createdAt)} · {c.messages.length} mensagens · {c.source === "claude" ? "Claude" : "ChatGPT"}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-3">
            <Button variant="primary" className="w-full" disabled={!picked.size || phase === "salvando"} onClick={() => save(pickedList, pickedList[0]?.source ?? "chatgpt")}>
              {phase === "salvando" ? `Salvando… ${progress}%` : `Importar ${picked.size} ${picked.size === 1 ? "conversa" : "conversas"}`}
            </Button>
          </div>
        </Card>
      ) : null}

      {phase === "pronto" ? (
        <Card className="overflow-hidden">
          <div className="space-y-1 border-b border-line p-4">
            <p className="font-medium">{saved.length} {saved.length === 1 ? "conversa salva" : "conversas salvas"} no Brain{skipped ? ` · ${skipped} já existiam` : ""}.</p>
            <p className="text-sm text-muted">Já dá para achar tudo na busca do Brain e no ⌘K.{" "}
              {aiConfigured ? "A IA pode ler o que você escreveu e propor ideias, decisões e tarefas. Elas entram na Inbox para você confirmar." : "Com uma chave de IA em Ajustes, dá para extrair ideias, decisões e tarefas dessas conversas."}
            </p>
            {aiConfigured && saved.length ? (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="primary" onClick={() => extract(saved.filter((s) => !s.extract).slice(0, 10).map((s) => s.id))}>
                  Extrair das {Math.min(10, saved.filter((s) => !s.extract).length)} próximas
                </Button>
                <Link href="/inbox" className="inline-flex h-9 items-center px-2 text-sm text-muted underline underline-offset-4">Abrir Inbox</Link>
              </div>
            ) : null}
          </div>
          {saved.length ? (
            <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto">
              {saved.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  {s.extract === "rodando" ? <span className="text-xs text-muted">lendo…</span> : null}
                  {s.extract === "ok" ? <Badge tone="ok">{s.count ? `${s.count} na Inbox` : "nada útil"}</Badge> : null}
                  {s.extract === "erro" ? <span className="max-w-[45%] truncate text-xs text-accent" title={s.error}>{s.error}</span> : null}
                  {aiConfigured && !s.extract ? (
                    <button type="button" onClick={() => extract([s.id])} className="shrink-0 text-xs text-muted underline underline-offset-4">Extrair</button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

/** Conversas importadas antes que ainda não passaram pela extração. */
export function PendingExtraction({ notes }: { notes: { id: string; title: string }[] }) {
  const [rows, setRows] = useState<Saved[]>(notes);
  const [running, setRunning] = useState(false);
  async function run(ids: string[]) {
    setRunning(true);
    for (const id of ids) {
      setRows((s) => s.map((x) => (x.id === id ? { ...x, extract: "rodando" } : x)));
      const r = await extractToInbox(id).catch(() => ({ error: "Falha de conexão." } as { error: string; count?: number }));
      setRows((s) => s.map((x) => (x.id === id ? { ...x, extract: r.error ? "erro" : "ok", count: r.count, error: r.error } : x)));
      if (r.error?.includes("Limite")) break;
    }
    setRunning(false);
  }
  const todo = rows.filter((r) => !r.extract);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line p-3">
        <span className="text-sm text-muted">{todo.length} sem extração</span>
        <Button size="sm" variant="primary" className="ml-auto" disabled={running || !todo.length} onClick={() => run(todo.slice(0, 10).map((r) => r.id))}>
          {running ? "Lendo…" : `Extrair das ${Math.min(10, todo.length)} próximas`}
        </Button>
      </div>
      <ul className="max-h-80 divide-y divide-line overflow-y-auto">
        {rows.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{s.title}</span>
            {s.extract === "rodando" ? <span className="text-xs text-muted">lendo…</span> : null}
            {s.extract === "ok" ? <Badge tone="ok">{s.count ? `${s.count} na Inbox` : "nada útil"}</Badge> : null}
            {s.extract === "erro" ? <span className="max-w-[45%] truncate text-xs text-accent" title={s.error}>{s.error}</span> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
