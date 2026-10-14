import Link from "next/link";
import { HelpTip } from "./help-tip";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "bg-surface border border-line text-ink hover:border-line-strong",
  ghost: "text-muted hover:text-ink hover:bg-surface-2",
  danger: "text-accent hover:bg-accent-soft",
};

export const buttonClass = (variant: Variant = "secondary", size: "sm" | "md" = "md") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none select-none",
    size === "md" ? "h-11 px-4 text-[15px]" : "h-9 px-3 text-sm",
    variants[variant],
  );

export function Button({ variant = "secondary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function LinkButton({ variant = "secondary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-[10px] border border-line bg-surface", className)} {...props} />;
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="label">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold tracking-tight leading-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-[15px] text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border border-line bg-surface px-3 text-ink placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-accent";

export function Field({ label, hint, help, children, className }: { label: string; hint?: string; help?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block space-y-1.5", className)}>
      <span className="block text-sm font-medium">{label}{help ? <HelpTip text={help} /> : null}</span>
      {children}
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cx(inputBase, "py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cx(inputBase, "h-11 appearance-none pr-8 bg-[length:12px] bg-no-repeat bg-[right_12px_center]", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%239b978f' stroke-width='1.5'/%3E%3C/svg%3E\")" }}
      {...props}>
      {children}
    </select>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "ok" | "warn"; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    ok: "bg-surface-2 text-ok",
    warn: "bg-surface-2 text-warn",
  };
  return <span className={cx("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tones[tone], className)}>{children}</span>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-dashed border-line-strong px-5 py-8 text-center">
      <p className="font-medium">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SourceTag({ source }: { source: "ia" | "regras" | null | undefined }) {
  if (!source) return null;
  return (
    <span className="text-[11px] text-faint">{source === "ia" ? "Gerado pela IA com seu histórico" : "Gerado por regras a partir dos seus registros"}</span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{children}</p>;
}
