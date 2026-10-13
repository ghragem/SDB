"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { NAV, SECONDARY } from "./nav";
import { cx } from "./ui";

type Hit = { kind: string; id: string; title: string; snippet: string; href: string };

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) { setQ(""); setHits([]); setStatus("idle"); }
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) { setQ(""); setHits([]); setStatus("idle"); onOpenChange(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  const close = () => { setQ(""); setHits([]); setStatus("idle"); onOpenChange(false); };

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { results: Hit[] };
        setHits(json.results); setActive(0); setStatus("idle");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  if (!open) return null;

  const short = q.trim().length < 2;
  const visibleHits = short ? [] : hits;
  const pages = [...NAV, ...SECONDARY].filter((n) => !q || n.label.toLowerCase().includes(q.toLowerCase()));
  const items: { href: string; title: string; meta: string }[] = [
    ...visibleHits.map((h) => ({ href: h.href, title: h.title, meta: h.kind })),
    ...pages.map((p) => ({ href: p.href, title: p.label, meta: "ir para" })),
  ];
  const go = (href: string) => { close(); router.push(href); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Busca global">
      <button aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={17} className="text-faint" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter" && items[active]) go(items[active].href);
            }}
            placeholder="Projeto, nota, decisão, ideia…" className="h-13 w-full bg-transparent py-4 outline-none placeholder:text-faint" aria-label="Buscar" />
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-1.5" role="listbox">
          {!short && status === "loading" && !hits.length ? <li className="px-3 py-2 text-sm text-muted">Buscando…</li> : null}
          {!short && status === "error" ? <li className="px-3 py-2 text-sm text-accent">A busca falhou. Tente de novo.</li> : null}
          {!short && status === "idle" && !hits.length ? <li className="px-3 py-2 text-sm text-muted">Nada encontrado nos seus registros.</li> : null}
          {items.map((it, i) => (
            <li key={it.href + i} role="option" aria-selected={i === active}>
              <button onMouseEnter={() => setActive(i)} onClick={() => go(it.href)}
                className={cx("flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left", i === active ? "bg-surface-2" : "")}>
                <span className="truncate">{it.title}</span>
                <span className="shrink-0 text-[11px] uppercase tracking-wide text-faint">{it.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
