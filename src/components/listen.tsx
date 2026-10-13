"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Square, Volume2 } from "lucide-react";
import { cx } from "./ui";

// Lê o texto em voz alta com a voz do próprio aparelho (Web Speech API). Sem custo e funciona offline no iPhone.
function ptVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "pt-BR" && /luciana|felipe|google/i.test(v.name))
    ?? voices.find((v) => v.lang === "pt-BR")
    ?? voices.find((v) => v.lang.startsWith("pt"))
    ?? null;
}

const noop = () => () => {};

export function Listen({ text, className }: { text: string; className?: string }) {
  // false no servidor, real no aparelho (evita diferença de hidratação)
  const supported = useSyncExternalStore(noop, () => "speechSynthesis" in window, () => false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  if (!supported || !text.trim()) return null;

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    const v = ptVoice();
    if (v) u.voice = v;
    u.rate = 1.05;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  };

  return (
    <button type="button" onClick={toggle} aria-pressed={speaking} aria-label={speaking ? "Parar leitura" : "Ouvir em voz alta"}
      className={cx("inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] text-muted hover:border-line-strong hover:text-ink", speaking && "border-accent text-accent", className)}>
      {speaking ? <Square size={11} fill="currentColor" /> : <Volume2 size={13} />}
      {speaking ? "Parar" : "Ouvir"}
    </button>
  );
}
