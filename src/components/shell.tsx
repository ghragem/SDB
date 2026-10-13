"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bell, Flame, Menu, Plus, Search, Shield, Sun, X } from "lucide-react";
import type { DayState } from "@/lib/types";
import { MOBILE_TABS, NAV, SECONDARY } from "./nav";
import { cx } from "./ui";
import { QuickCapture } from "./quick-capture";
import { CommandPalette } from "./command-palette";

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

const MODES: { k: DayState; label: string; icon: typeof Sun }[] = [
  { k: "ataque", label: "Ataque", icon: Flame },
  { k: "normal", label: "Normal", icon: Sun },
  { k: "sobrevivencia", label: "Sobrevivência", icon: Shield },
];

export function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span className="flex items-center gap-2.5">
      <Image src="/logo-mark.png" alt="" width={size === "md" ? 30 : 26} height={size === "md" ? 30 : 26} className="rounded-[7px]" priority />
      <span className={cx("font-black uppercase leading-none tracking-[-0.01em]", size === "md" ? "text-[17px]" : "text-[14px]")}>Saindo do Bairro</span>
    </span>
  );
}

export function Shell({ children, noticeCount, inboxCount, name, dayState }: {
  children: ReactNode; noticeCount: number; inboxCount: number; name: string; dayState: DayState | null;
}) {
  const path = usePathname();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wide = path === "/hoje";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-bg px-3 py-5 lg:flex">
        <Link href="/hoje" className="mb-6 block px-2">
          <Wordmark />
          <span className="mt-1.5 block pl-[40px] text-[13px] text-muted">{name}</span>
        </Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto" aria-label="Principal">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={cx("flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors",
                  active ? "bg-accent-soft font-medium text-ink" : "text-muted hover:bg-surface hover:text-ink")}>
                <Icon size={17} strokeWidth={1.9} className={active ? "text-accent" : undefined} />
                {label}
                {href === "/inbox" && inboxCount > 0 ? <span className="ml-auto rounded-full bg-surface-2 px-1.5 text-[11px] tabular-nums text-muted">{inboxCount}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line pt-4">
          <p className="mb-1.5 px-3 text-[12px] text-faint">Modo do dia</p>
          {MODES.map(({ k, label, icon: Icon }) => (
            <Link key={k} href="/hoje" title={dayState ? undefined : "Defina no check-in de hoje"}
              className={cx("flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px]",
                dayState === k ? "bg-accent-soft font-medium text-ink" : "text-muted hover:text-ink")}>
              <Icon size={15} className={dayState === k ? "text-accent" : undefined} />
              {label}
            </Link>
          ))}
          {!dayState ? <p className="px-3 pt-1 text-[11.5px] text-faint">Sai do check-in de hoje.</p> : null}
        </div>
      </aside>

      <div className="min-w-0">
        {/* Topo desktop */}
        <div className="sticky top-0 z-30 hidden h-16 items-center gap-3 border-b border-line bg-bg/90 px-8 backdrop-blur lg:flex">
          <button onClick={() => setSearchOpen(true)}
            className="flex h-10 w-full max-w-xl items-center gap-2.5 rounded-lg border border-line bg-surface px-3 text-sm text-faint hover:border-line-strong">
            <Search size={16} /> Buscar no seu brain (projetos, ideias, decisões, notas)
            <kbd className="ml-auto rounded border border-line px-1.5 font-mono text-[10px]">⌘K</kbd>
          </button>
          <button onClick={() => setCaptureOpen(true)} className="ml-auto flex h-10 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-fg hover:bg-accent-hover">
            <Plus size={16} /> Capturar
          </button>
          <Link aria-label="Notificações" href="/notificacoes" className="relative grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink">
            <Bell size={19} />
            {noticeCount > 0 ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" /> : null}
          </Link>
          <Link href="/ajustes" className="flex items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-surface">
            <Avatar name={name} />
            <span className="text-sm leading-tight"><span className="block font-medium">{name}</span><span className="text-xs text-muted">Ajustes</span></span>
          </Link>
        </div>

        {/* Topo mobile */}
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur lg:hidden">
          <div className="flex h-12 items-center gap-1 px-4">
            <Link href="/hoje" className="mr-auto"><Wordmark size="sm" /></Link>
            <button aria-label="Buscar" onClick={() => setSearchOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg text-muted"><Search size={19} /></button>
            <Link aria-label="Notificações" href="/notificacoes" className="relative grid h-10 w-10 place-items-center rounded-lg text-muted">
              <Bell size={19} />
              {noticeCount > 0 ? <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent" /> : null}
            </Link>
          </div>
        </header>

        <main className={cx("mx-auto w-full px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8", wide ? "max-w-[1240px]" : "max-w-3xl")}>{children}</main>
      </div>

      {/* Bottom nav mobile: Hoje, Aprender, +, Projetos, Mais */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur lg:hidden" aria-label="Navegação">
        <div className="grid h-16 grid-cols-5 items-center">
          {MOBILE_TABS.slice(0, 2).map((href) => <Tab key={href} href={href} active={isActive(path, href)} />)}
          <div className="flex justify-center">
            <button aria-label="Capturar" onClick={() => setCaptureOpen(true)}
              className="grid h-14 w-14 -translate-y-2 place-items-center rounded-full bg-accent text-accent-fg shadow-[0_6px_20px_rgba(232,48,42,0.35)] transition-transform active:scale-95">
              <Plus size={28} />
            </button>
          </div>
          {MOBILE_TABS.slice(2).map((href) => <Tab key={href} href={href} active={isActive(path, href)} />)}
          <button onClick={() => setMenuOpen(true)} aria-label="Mais"
            className={cx("flex h-full flex-col items-center justify-center gap-1 text-[10.5px] font-medium", menuOpen ? "text-accent" : "text-faint")}>
            <Menu size={21} strokeWidth={1.7} />
            Mais
          </button>
        </div>
      </nav>

      {/* Menu "Mais" mobile */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Mais">
          <button aria-label="Fechar" className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="pb-safe absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="label">Mais</span>
              <button aria-label="Fechar" onClick={() => setMenuOpen(false)} className="grid h-9 w-9 place-items-center text-muted"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[...NAV, ...SECONDARY].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                  className={cx("flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border text-[13px]",
                    isActive(path, href) ? "border-accent/50 bg-accent-soft font-medium" : "border-line text-muted")}>
                  <Icon size={19} strokeWidth={1.8} className={isActive(path, href) ? "text-accent" : undefined} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span style={{ width: size, height: size }} aria-hidden
      className="grid shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 text-[13px] font-semibold">
      {name.trim().charAt(0).toUpperCase() || "G"}
    </span>
  );
}

function Tab({ href, active }: { href: string; active: boolean }) {
  const item = NAV.find((n) => n.href === href)!;
  const Icon = item.icon;
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cx("flex h-full flex-col items-center justify-center gap-1 text-[10.5px] font-medium", active ? "text-accent" : "text-faint")}>
      <Icon size={21} strokeWidth={active ? 2.1 : 1.7} />
      {item.label}
    </Link>
  );
}
