"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listQueued, offlineSupported, removeQueued, type QueuedCapture } from "@/lib/offline-queue";

const extOf = (mime: string) => (mime.includes("mp4") || mime.includes("m4a") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm");

/** Sobe para a Inbox o que foi capturado sem internet. Roda ao abrir o app e quando a conexão volta. */
export function OfflineSync() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const busy = useRef(false);

  const sync = useCallback(async () => {
    if (busy.current || !offlineSupported() || !navigator.onLine) return;
    busy.current = true;
    try {
      const queued = await listQueued().catch(() => [] as QueuedCapture[]);
      if (!queued.length) return;
      const supabase = createClient();
      const { data: claims } = await supabase.auth.getClaims();
      const uid = claims?.claims?.sub;
      if (!uid) return;
      let ok = 0;
      for (const q of queued.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
        let audioPath: string | null = null;
        let body = q.body.trim();
        if (q.audio && q.audio.size > 0) {
          const mime = (q.mime || q.audio.type || "audio/webm").split(";")[0];
          const path = `${uid}/offline/${q.id}.${extOf(mime)}`;
          const up = await supabase.storage.from("audio").upload(path, q.audio, { contentType: mime, upsert: true });
          if (up.error) continue; // tenta de novo na próxima vez
          audioPath = path;
          if (!body) {
            try {
              const fd = new FormData();
              fd.append("audio", q.audio, `audio.${extOf(mime)}`);
              const res = await fetch("/api/transcribe", { method: "POST", body: fd });
              const json = res.ok ? ((await res.json()) as { text?: string | null }) : null;
              if (json?.text) body = json.text.trim();
            } catch { /* sem transcrição: o áudio fica para ouvir na Inbox */ }
          }
        }
        const { error } = await supabase.from("inbox_items").insert({
          user_id: uid,
          kind: q.audio ? "audio" : q.kind,
          body: body || "Áudio gravado sem internet. Ouça e classifique.",
          amount: q.amount ?? null,
          metadata: { offline: true, captured_at: q.createdAt, audio_path: audioPath, duration_sec: q.durationSec ?? null, original_kind: q.kind },
        });
        if (error) continue;
        await removeQueued(q.id).catch(() => {});
        ok++;
      }
      if (ok) {
        setMsg(`${ok} ${ok === 1 ? "captura feita sem internet foi enviada" : "capturas feitas sem internet foram enviadas"} para a Inbox.`);
        router.refresh();
        setTimeout(() => setMsg(null), 6000);
      }
    } finally {
      busy.current = false;
    }
  }, [router]);

  useEffect(() => {
    sync();
    const onOnline = () => sync();
    const onQueued = () => {
      if (navigator.onLine) sync();
      else { setMsg("Sem internet: guardado no aparelho. Sobe sozinho para a Inbox quando a conexão voltar."); setTimeout(() => setMsg(null), 6000); }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("sdb:queued", onQueued);
    const onVisible = () => document.visibilityState === "visible" && sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("sdb:queued", onQueued);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sync]);

  if (!msg) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-50 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lg lg:bottom-6">
      <CloudUpload size={16} className="shrink-0 text-ok" /> {msg}
    </div>
  );
}
