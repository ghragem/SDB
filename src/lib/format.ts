export const TZ = "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo. */
export function todaySP(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function weekStartSP(d = new Date()) {
  const day = new Date(todaySP(d) + "T12:00:00Z");
  const dow = (day.getUTCDay() + 6) % 7; // segunda = 0
  day.setUTCDate(day.getUTCDate() - dow);
  return day.toISOString().slice(0, 10);
}

export function addDays(isoDay: string, n: number) {
  const d = new Date(isoDay + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDay(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = iso.length <= 10 ? new Date(iso + "T12:00:00Z") : new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(d);
}

export function fmtDateLong(d = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export function fmtPct(n: number | null) {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1).replace(".", ",")}%`;
}

/** Dias inteiros desde um timestamp (null = nunca). */
export function daysSince(ts: string | null | undefined) {
  if (!ts) return null;
  const ms = Date.now() - new Date(ts).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function greeting(d = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(d));
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function parseMoney(v: FormDataEntryValue | null) {
  if (v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Aceita "1.234,56", "1234,56", "1234.56"
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function str(v: FormDataEntryValue | null) {
  const s = v === null ? "" : String(v).trim();
  return s.length ? s : null;
}
