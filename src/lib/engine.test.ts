// npm test — regras do motor operacional com casos concretos.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actionQuality, computeAlerts, dayMode, decisionQueue, nextActions, rankProjects, riskQueue, scoreProject,
  type DecisionRow, type ExperimentRow, type ProjectFacts, type ScoreProject,
} from "./engine.ts";

const TODAY = "2026-10-20";
const proj = (o: Partial<ScoreProject>): ScoreProject => ({
  id: o.name ?? "p", name: "P", status: "construcao", priority: 2, next_action: null, next_proof: null, blocker: null,
  deadline: null, last_progress_at: null, created_at: "2026-09-01T12:00:00Z", ...o,
});
const facts = (o: Partial<ProjectFacts> = {}): ProjectFacts => ({ progressCount: 0, revenue90: 0, spent90: 0, ...o });

test("modo do dia: regra objetiva", () => {
  assert.equal(dayMode(5, 5, 1).state, "ataque");
  assert.equal(dayMode(4, 4, 3).state, "ataque");
  assert.equal(dayMode(4, 4, 4).state, "normal");
  assert.equal(dayMode(3, 4, 2).state, "normal");
  assert.equal(dayMode(2, 5, 1).state, "sobrevivencia");
  assert.equal(dayMode(5, 2, 1).state, "sobrevivencia");
  assert.equal(dayMode(4, 5, 5).state, "sobrevivencia");
  assert.equal(dayMode(3, 4, 4).state, "sobrevivencia");
  const sem = dayMode(null, null, null);
  assert.equal(sem.state, "normal");
  assert.equal(sem.objective, false);
  assert.equal(dayMode(null, null, null, true).state, "sobrevivencia");
});

test("próxima ação: ausente, vaga, concreta", () => {
  assert.equal(actionQuality("").level, "ausente");
  assert.equal(actionQuality(null).level, "ausente");
  assert.equal(actionQuality("Melhorar AutoFlow").level, "vaga");
  assert.equal(actionQuality("Melhorar o fluxo de orçamento do AutoFlow").level, "vaga");
  assert.equal(actionQuality("Ligar para 3 oficinas e validar o fluxo de orçamento.").level, "ok");
  assert.equal(actionQuality("Revisar 5 contratos com oficinas").level, "ok");
  assert.equal(actionQuality("Mandar proposta para a oficina do Zé").level, "ok");
});

test("score explicável: exemplo do pedido", () => {
  const p = proj({ name: "AutoFlow", priority: 1, last_progress_at: "2026-10-12T15:00:00Z", next_action: "Ligar para 3 oficinas e validar o fluxo de orçamento." });
  const s = scoreProject(p, facts({ revenue90: 1200 }), TODAY, "normal", true);
  const pts = Object.fromEntries(s.factors.map((f) => [f.label.replace(/ /g, " "), f.points]));
  assert.equal(pts["prioridade alta"], 30);
  assert.equal(pts["8 dias sem avanço"], 20);
  assert.equal(pts["próxima ação definida"], 15);
  assert.equal(pts["em construção"], 10);
  assert.equal(pts["R$ 1.200 de receita em 90 dias"], 10);
  assert.equal(s.score, 85);
  assert.equal(s.score, s.factors.reduce((a, f) => a + f.points, 0));
});

test("score: sobrevivência protege o principal e reduz o resto", () => {
  const a = scoreProject(proj({ name: "A", priority: 1, next_action: "Ligar para 3 oficinas hoje" }), facts(), TODAY, "sobrevivencia", true);
  const b = scoreProject(proj({ name: "B", priority: 1, next_action: "Ligar para 3 oficinas hoje" }), facts(), TODAY, "sobrevivencia", false);
  assert.equal(a.score - b.score, 20);
  assert.ok(a.factors.some((f) => f.label.startsWith("sobrevivência") && f.points === 10));
});

test("score: prazo, sem ação, sem avanço desde o cadastro", () => {
  const s = scoreProject(proj({ deadline: "2026-10-18", created_at: "2026-10-01T12:00:00Z" }), facts(), TODAY, null, false);
  const labels = s.factors.map((f) => `${f.label}=${f.points}`);
  assert.ok(labels.includes("prazo vencido há 2 dias=25"));
  assert.ok(labels.includes("sem avanço desde o cadastro (19 dias) (peso metade: prioridade média)=13"));
  assert.ok(labels.includes("sem próxima ação=-10"));
  assert.equal(s.neverProgressed, true);
});

test("ranking: score, depois prioridade; inativos ficam fora", () => {
  const list = [
    proj({ name: "Pausado", status: "pausado", priority: 1 }),
    proj({ name: "B", priority: 2, next_action: "Ligar para 3 oficinas hoje", created_at: "2026-10-20T10:00:00Z" }),
    proj({ name: "A", priority: 1, next_action: "Ligar para 3 oficinas hoje", created_at: "2026-10-20T10:00:00Z" }),
  ];
  const r = rankProjects(list, new Map(), TODAY, null);
  assert.deepEqual(r.map((x) => x.project.name), ["A", "B"]);
});

test("alerta anti-dispersão com números reais", () => {
  const top = proj({ name: "AutoFlow", priority: 1, last_progress_at: "2026-10-11T12:00:00Z", next_action: "Ligar para 3 oficinas hoje" });
  const ranked = rankProjects([top], new Map(), TODAY, null);
  const ideas = ["2026-10-15", "2026-10-17", "2026-10-19"].map((d, i) => ({ id: String(i), created_at: `${d}T12:00:00Z` }));
  const alerts = computeAlerts({ today: TODAY, state: null, ranked, ideasLast7d: ideas, decisions: [], risks: [] });
  assert.equal(alerts[0].text, "Você abriu 3 ideias novas enquanto AutoFlow está parado há 9 dias.");
});

test("secundário esquecido não passa o principal só por estar parado", () => {
  const main = proj({ name: "AutoFlow", priority: 1, last_progress_at: "2026-10-19T12:00:00Z", next_action: "Ligar para 3 oficinas hoje" });
  const old = proj({ name: "R4DAR", priority: 2, created_at: "2026-09-01T12:00:00Z", next_action: "Ligar para 3 oficinas hoje" });
  const low = proj({ name: "Baixa", priority: 3, created_at: "2026-09-01T12:00:00Z", next_action: "Ligar para 3 oficinas hoje" });
  const r = rankProjects([old, low, main], new Map(), TODAY, null);
  assert.deepEqual(r.map((x) => x.project.name), ["AutoFlow", "R4DAR", "Baixa"]);
  assert.equal(r.find((x) => x.project.name === "Baixa")!.factors.find((f) => f.label.includes("sem avanço"))!.points, 0);
});

test("alerta: projeto novo antes da prova do principal; sem alerta no cadastro inicial", () => {
  const top = proj({ name: "AutoFlow", priority: 1, created_at: "2026-10-01T12:00:00Z", last_progress_at: "2026-10-19T12:00:00Z", next_action: "Ligar para 3 oficinas hoje", next_proof: "1 oficina usando" });
  const sameDay = proj({ name: "R4DAR", priority: 2, created_at: "2026-10-01T15:00:00Z", next_action: "Ligar para 3 oficinas hoje" });
  const later = proj({ name: "Novo", priority: 2, created_at: "2026-10-16T12:00:00Z", next_action: "Ligar para 3 oficinas hoje" });
  const none = computeAlerts({ today: TODAY, state: null, ranked: rankProjects([top, sameDay], new Map(), TODAY, null), ideasLast7d: [], decisions: [], risks: [] });
  assert.equal(none.length, 0);
  const some = computeAlerts({ today: TODAY, state: null, ranked: rankProjects([top, later], new Map(), TODAY, null), ideasLast7d: [], decisions: [], risks: [] });
  assert.match(some[0].text, /^Novo começou há 4 dias enquanto AutoFlow ainda não fechou a próxima prova: 1 oficina usando\.$/);
});

test("fila de risco: 80% do limite", () => {
  const e: ExperimentRow = { id: "e", hypothesis: "Campanha X vende", status: "rodando", max_amount: 500, deadline: "2026-10-30", stop_condition: "CPA > 80", scale_condition: "CPA < 40", decision_id: null, spent: 410 };
  const [r] = riskQueue([e], TODAY);
  assert.equal(r.pct, 82);
  assert.equal(r.message, "Você já consumiu 82% do limite deste teste.");
  const [vencido] = riskQueue([{ ...e, spent: 0, deadline: "2026-10-19" }], TODAY);
  assert.equal(vencido.message, "Prazo venceu em 19/10 sem conclusão registrada.");
});

test("fila de decisões: revisão atrasada > prazo vencendo > sem veredito", () => {
  const base: DecisionRow = { id: "", title: "", status: "aberta", verdict: null, deadline: null, review_at: null, amount: null, max_loss: null, reversibility: null, evidence: null, downside: null, alternatives: null, premortem: null, created_at: "2026-10-01" };
  const q = decisionQueue([
    { ...base, id: "a", title: "Sem veredito" },
    { ...base, id: "b", title: "Prazo amanhã", deadline: "2026-10-21" },
    { ...base, id: "c", title: "Revisar", status: "decidida", verdict: "fazer", review_at: "2026-10-18" },
    { ...base, id: "d", title: "Cancelada", status: "cancelada" },
  ], TODAY);
  assert.deepEqual(q.map((x) => x.d.id), ["c", "b", "a"]);
  assert.equal(q[1].reason, "prazo em 1 dia");
  assert.ok(q[2].missing.includes("perda máxima"));
});

test("próximas ações: no máximo 3; sobrevivência reduz escopo", () => {
  const a = proj({ id: "a", name: "AutoFlow", priority: 1, next_action: "Ligar para 3 oficinas hoje", last_progress_at: "2026-10-19T12:00:00Z" });
  const b = proj({ id: "b", name: "R4DAR", priority: 2, next_action: "Cadastrar 10 anúncios de iPhone", last_progress_at: "2026-10-19T12:00:00Z" });
  const ranked = rankProjects([a, b], new Map(), TODAY, "normal");
  const normal = nextActions({ state: "normal", ranked, progressedToday: new Set(["a"]), carriedFromYesterday: null, decisions: [], risks: [], reviewDone: false });
  assert.equal(normal.length, 3);
  assert.equal(normal[0].done, true);
  assert.equal(normal[2].key, "revisao");
  const surv = nextActions({ state: "sobrevivencia", ranked: rankProjects([a, b], new Map(), TODAY, "sobrevivencia"), progressedToday: new Set(), carriedFromYesterday: null, decisions: [], risks: [], reviewDone: false });
  assert.deepEqual(surv.map((x) => x.key), ["acao-a", "revisao"]);
  assert.match(surv[0].label, /^5 minutos em AutoFlow/);
  const semAcao = nextActions({ state: "normal", ranked: rankProjects([{ ...a, next_action: null }], new Map(), TODAY, "normal"), progressedToday: new Set(), carriedFromYesterday: "Mandar orçamento às 9h", decisions: [], risks: [], reviewDone: true });
  assert.equal(semAcao[0].label, "Mandar orçamento às 9h");
  assert.ok(semAcao[1].define);
  assert.equal(semAcao.length, 3);
});
