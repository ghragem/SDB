"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bell, Menu, Plus, Search, X } from "lucide-react";
import { MOBILE_TABS, NAV, SECONDARY } from "./nav";
import { cx } from "./ui";
import { QuickCapture } from "./quick-capture";
import { CommandPalette } from "./command-palette";

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

export function Shell({ children, noticeCount, inboxCount }: { children: ReactNode; noticeCount: number; inboxCount: number }) {
  const path = usePathname();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-bg px-3 py-4 lg:flex">
        <Link href="/hoje" className="mb-5 flex items-center gap-2 px-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden />
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">Saindo do Bairro</span>
        </Link>
        <button onClick={() => setSearchOpen(true)} className="mb-3 flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-sm text-muted hover:border-line-strong">
          <Search size={15} /> Buscar
          <kbd className="ml-auto rounded border border-line px-1.5 font-mono text-[10px]">⌘K</kbd>
        </button>
        <button onClick={() => setCaptureOpen(true)} className="mb-4 flex h-9 items-center gap-2 rounded-lg bg-ink px-2.5 text-sm font-medium text-bg">
          <Plus size={15} /> Capturar
        </button>
        <nav className="flex-1 space-y-0.5 overflow-y-auto" aria-label="Principal">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}
              className={cx("flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] transition-colors",
                isActive(path, href) ? "bg-surface-2 font-medium text-ink" : "text-muted hover:bg-surface-2 hover:text-ink")}>
              <Icon size={16} strokeWidth={1.8} />
              {label}
              {href === "/inbox" && inboxCount > 0 ? <span className="ml-auto text-xs tabular-nums text-faint">{inboxCount}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="space-y-0.5 border-t border-line pt-3">
          {SECONDARY.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}
              className={cx("flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px]",
                isActive(path, href) ? "bg-surface-2 font-medium" : "text-muted hover:bg-surface-2 hover:text-ink")}>
              <Icon size={16} strokeWidth={1.8} />
              {label}
              {href === "/notificacoes" && noticeCount > 0 ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" aria-label={`${noticeCount} avisos`} /> : null}
            </Link>
          ))}
        </div>
      </aside>

      <div className="min-w-0">
        {/* Header mobile */}
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur lg:hidden">
          <div className="flex h-12 items-center gap-1 px-4">
            <Link href="/hoje" className="mr-auto flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm bg-accent" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Saindo do Bairro</span>
            </Link>
            <button aria-label="Buscar" onClick={() => setSearchOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg text-muted"><Search size={19} /></button>
            <Link aria-label="Notificações" href="/notificacoes" className="relative grid h-10 w-10 place-items-center rounded-lg text-muted">
              <Bell size={19} />
              {noticeCount > 0 ? <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent" /> : null}
            </Link>
            <button aria-label="Mais" onClick={() => setMenuOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg text-muted"><Menu size={19} /></button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur lg:hidden" aria-label="Navegação">
        <div className="grid h-16 grid-cols-5 items-center">
          {MOBILE_TABS.slice(0, 2).map((href) => <Tab key={href} href={href} active={isActive(path, href)} />)}
          <div className="flex justify-center">
            <button aria-label="Capturar" onClick={() => setCaptureOpen(true)} className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-fg shadow-[0_2px_8px_rgba(0,0,0,0.15)] active:scale-95 transition-transform">
              <Plus size={24} />
            </button>
          </div>
          {MOBILE_TABS.slice(2).map((href) => <Tab key={href} href={href} active={isActive(path, href)} />)}
        </div>
      </nav>

      {/* Menu "Mais" mobile */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Mais">
          <button aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="pb-safe absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="label">Mais</span>
              <button aria-label="Fechar" onClick={() => setMenuOpen(false)} className="grid h-9 w-9 place-items-center text-muted"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[...NAV, ...SECONDARY].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                  className={cx("flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border text-[13px]",
                    isActive(path, href) ? "border-line-strong bg-surface-2 font-medium" : "border-line text-muted")}>
                  <Icon size={19} strokeWidth={1.8} />
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

function Tab({ href, active }: { href: string; active: boolean }) {
  const item = NAV.find((n) => n.href === href)!;
  const Icon = item.icon;
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cx("flex h-full flex-col items-center justify-center gap-1 text-[10.5px] font-medium", active ? "text-ink" : "text-faint")}>
      <Icon size={21} strokeWidth={active ? 2.1 : 1.7} />
      {item.label}
    </Link>
  );
}
