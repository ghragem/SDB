// npm test — interpretação de captura por regras.
import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryOf, findProject, interpretRules, parseAmount } from "./interpret.ts";

const P = [
  { id: "af", name: "AutoFlow" },
  { id: "r4", name: "R4DAR" },
  { id: "cb", name: "Coach de Bolso" },
];
const brief = (items: ReturnType<typeof interpretRules>) => items.map((i) => `${i.kind}|${i.projectId ?? "-"}|${i.amount ?? "-"}|${i.text}`);

test("exemplo do pedido vira 6 registros separados", () => {
  const items = interpretRules(
    "Hoje avancei o AutoFlow. Falei com duas oficinas, uma pediu demonstração. Também gastei 120 reais numa campanha do Coach e acho que o criativo novo não ficou bom. Tive uma ideia de revender iPhone mas não quero começar isso agora.",
    P,
  );
  assert.deepEqual(brief(items), [
    "avanco|af|-|Avancei o AutoFlow",
    "avanco|af|-|Falei com duas oficinas",
    "evidencia|af|-|Uma pediu demonstração",
    "despesa|cb|120|Gastei 120 reais numa campanha do Coach",
    "hipotese|cb|-|Acho que o criativo novo não ficou bom",
    "ideia|-|-|Revender iPhone",
    "decisao|-|-|Não começar agora: Revender iPhone",
  ]);
  assert.equal(categoryOf(items[3].text), "ads");
});

test("'Atualiza o AutoFlow:' define o projeto", () => {
  const items = interpretRules("Atualiza o AutoFlow: hoje uma oficina pediu demonstração.", P);
  assert.deepEqual(brief(items), ["evidencia|af|-|Uma oficina pediu demonstração"]);
});

test("projeto padrão (captura aberta dentro do projeto)", () => {
  const items = interpretRules("Terminei a tela de orçamento", P, "r4");
  assert.equal(items[0].kind, "avanco");
  assert.equal(items[0].projectId, "r4");
});

test("sem sinal vira nota com confiança baixa; não inventa projeto", () => {
  const items = interpretRules("O dia foi corrido", P);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "nota");
  assert.equal(items[0].confidence, "baixa");
  assert.equal(items[0].projectId, null);
});

test("valores em reais", () => {
  assert.equal(parseAmount("gastei R$ 1.250,50 hoje"), 1250.5);
  assert.equal(parseAmount("paguei 120 reais"), 120);
  assert.equal(parseAmount("investi 2 mil"), 2000);
  assert.equal(parseAmount("recebi R$80"), 80);
  assert.equal(parseAmount("falei com 3 oficinas"), null);
});

test("receita, bloqueio, tarefa, aprendizado", () => {
  const items = interpretRules("Recebi 300 reais do Coach. Travei no deploy do R4DAR. Preciso ligar para o contador. Aprendi que tráfego frio não converte no primeiro clique.", P);
  assert.deepEqual(items.map((i) => `${i.kind}|${i.projectId ?? "-"}|${i.amount ?? "-"}`), [
    "receita|cb|300", "bloqueio|r4|-", "tarefa|r4|-", "aprendizado|r4|-",
  ]);
});

test("palavra marcante do nome do projeto", () => {
  assert.equal(findProject("campanha do coach", P)?.id, "cb");
  assert.equal(findProject("bolso", P), null); // palavra genérica não identifica
  assert.equal(findProject("r4dar travou", P)?.id, "r4");
});

test("check-in que diz ter avançado um projeto", async () => {
  const { claimedProgress } = await import("./interpret.ts");
  assert.deepEqual(claimedProgress("Hoje avancei o AutoFlow e estou cansado", P), ["af"]);
  assert.deepEqual(claimedProgress("Pensei no AutoFlow mas não fiz nada", P), []);
});
