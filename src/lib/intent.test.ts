// npm test — as perguntas do pedido caem na intenção certa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectIntent } from "./intent.ts";

test("perguntas do Gustavo → intenção", () => {
  const cases: [string, string][] = [
    ["O que eu deveria fazer agora?", "agora"],
    ["O que faço agora?", "agora"],
    ["Onde estou me dispersando?", "dispersao"],
    ["O que ficou parado essa semana?", "parado"],
    ["O que está parado?", "parado"],
    ["Vale a pena eu começar essa ideia?", "ideia"],
    ["O que está acontecendo com meu dinheiro?", "dinheiro"],
    ["Qual projeto merece minha atenção?", "projeto"],
    ["O que eu aprendi sobre tráfego nos últimos meses?", "historico"],
    ["O que estou evitando?", "evitando"],
    ["O que exige decisão?", "decisao"],
    ["campanha do coach", "busca"],
  ];
  for (const [q, want] of cases) assert.equal(detectIntent(q), want, q);
});
