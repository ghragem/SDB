import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTranscriber } from "@/lib/ai";

const MAX = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const t = getTranscriber();
  if (!t?.transcribe) return NextResponse.json({ error: "transcricao_nao_configurada" }, { status: 501 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "audio_ausente" }, { status: 400 });
  if (audio.size > MAX) return NextResponse.json({ error: "audio_grande_demais" }, { status: 413 });
  try {
    const text = await t.transcribe(audio, (audio as File).name || "audio.webm");
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "falha_transcricao" }, { status: 502 });
  }
}
