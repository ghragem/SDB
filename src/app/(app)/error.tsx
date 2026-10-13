"use client";

import { Button } from "@/components/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-16">
      <h1 className="text-xl font-semibold">Não consegui carregar esta tela.</h1>
      <p className="mt-1 text-muted">Pode ser a conexão ou o banco fora do ar. Nada do que você salvou foi perdido.</p>
      <Button variant="primary" className="mt-6" onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
