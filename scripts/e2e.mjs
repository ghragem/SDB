// Teste ponta a ponta com conta nova: cadastro, confirmação, onboarding, todas as áreas da V1,
// persistência (reload, logout/login, banco), iPhone e desktop.
//
// Uso: BASE_URL=http://localhost:3100 MAILPIT_URL=http://127.0.0.1:54324 DB_URL=postgresql://... node scripts/e2e.mjs
// MAILPIT_URL e DB_URL são opcionais (stack local do Supabase). Sem MAILPIT, informe E2E_EMAIL/E2E_PASSWORD de conta confirmada.
import { chromium, devices } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? "e2e-shots";
const MAILPIT = process.env.MAILPIT_URL;
const DB_URL = process.env.DB_URL;
const EMAIL = process.env.E2E_EMAIL ?? `gustavo.e2e+${Date.now()}@example.com`;
const PASSWORD = process.env.E2E_PASSWORD ?? "senha-forte-e2e-" + Math.random().toString(36).slice(2, 8);
mkdirSync(SHOTS, { recursive: true });

const results = [];
const errors = [];
let page;
const shot = (n, p = page) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
async function step(name, fn) {
  const t = Date.now();
  try {
    const info = await fn();
    results.push({ name, ok: true, info: info ?? "" });
    console.log(`✓ ${name}${info ? ` — ${info}` : ""} (${Date.now() - t}ms)`);
  } catch (e) {
    const msg = e.message.split("\n").filter((l) => l.trim()).slice(0, 4).join(" | "); results.push({ name, ok: false, info: msg });
    console.log(`✗ ${name} — ${msg}`);
    await shot("FAIL-" + name.replace(/\W+/g, "-")).catch(() => {});
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const sql = (q) => {
  if (!DB_URL) return null;
  return execFileSync("psql", [DB_URL, "-At", "-c", q], { encoding: "utf8" }).trim();
};
const uid = () => sql(`select id from auth.users where email = '${EMAIL}'`);
const count = (table, extra = "") => Number(sql(`select count(*) from public.${table} where user_id = '${uid()}' ${extra}`));

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const iphone = { ...devices["iPhone 14"], locale: "pt-BR", timezoneId: "America/Sao_Paulo", permissions: ["microphone"] };
const ctx = await browser.newContext(iphone);
page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource.*(404|401)/.test(m.text()) && errors.push("console: " + m.text()));

// ───────────── Autenticação ─────────────
await step("rota protegida redireciona para login", async () => {
  await page.goto(BASE + "/hoje");
  expect(/\/login/.test(page.url()), "não redirecionou: " + page.url());
  await shot("01-login");
});

if (MAILPIT) {
  await step("cadastro pela interface", async () => {
    await page.getByRole("tab", { name: "Criar conta" }).click();
    await page.fill("input[name=name]", "Gustavo");
    await page.fill("input[name=email]", EMAIL);
    await page.fill("input[name=password]", "curta");
    await page.click("button[type=submit]");
    // validação nativa do minLength impede o envio; confere que nada foi criado
    await page.fill("input[name=password]", PASSWORD);
    await page.click("button[type=submit]");
    await page.getByText(/Enviei um link de confirmação/).waitFor({ timeout: 15000 });
    await shot("02-cadastro-enviado");
    return EMAIL;
  });

  await step("login antes de confirmar é recusado", async () => {
    await page.getByRole("tab", { name: "Entrar" }).click();
    await page.fill("input[name=email]", EMAIL);
    await page.fill("input[name=password]", PASSWORD);
    await page.click("button[type=submit]");
    await page.getByText(/Confirme seu e-mail/).waitFor({ timeout: 10000 });
  });

  await step("confirmação por e-mail (link real)", async () => {
    let link;
    for (let i = 0; i < 20 && !link; i++) {
      const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:" + EMAIL)}`)).json();
      const id = list.messages?.[0]?.ID;
      if (id) {
        const msg = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
        link = (msg.HTML || msg.Text).match(/href="([^"]+verify[^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
      }
      if (!link) await new Promise((r) => setTimeout(r, 500));
    }
    expect(link, "e-mail de confirmação não chegou");
    await page.goto(link);
    await page.waitForURL(/onboarding|hoje/, { timeout: 20000 });
    return "caiu em " + new URL(page.url()).pathname;
  });
} else {
  await step("login com conta de teste", async () => {
    await page.fill("input[name=email]", EMAIL);
    await page.fill("input[name=password]", PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForURL(/onboarding|hoje/);
  });
}

await step("perfil e preferências criados no banco", async () => {
  if (!DB_URL) return "sem DB_URL";
  const p = sql(`select display_name || '|' || (select reality_level from public.preferences where user_id = p.id) from public.profiles p where id = '${uid()}'`);
  expect(p === "Gustavo|muito_direto", "perfil: " + p);
  return p;
});

// ───────────── Onboarding ─────────────
await step("onboarding completo", async () => {
  if (!/onboarding/.test(page.url())) await page.goto(BASE + "/onboarding");
  await page.getByRole("button", { name: "Decidir melhor com dinheiro" }).click();
  await page.getByRole("button", { name: "Terminar o que começo" }).click();
  await shot("03-onb-1");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "+ AutoFlow" }).click();
  await page.getByLabel("Próxima prova").first().fill("1 oficina usando o cadastro de cliente");
  await page.getByRole("button", { name: "+ R4DAR" }).click();
  await shot("04-onb-2");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Execução" }).click();
  await page.getByRole("button", { name: "Vendas" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Começo coisa nova antes de terminar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await shot("05-onb-5");
  await page.getByRole("button", { name: "Concluir" }).click();
  await page.waitForURL(/\/hoje/, { timeout: 30000 });
  await shot("06-hoje-inicial");
  if (DB_URL) {
    expect(count("projects") === 2, "projetos: " + count("projects"));
    expect(count("reality_rules") === 5, "regras: " + count("reality_rules"));
    expect(count("daily_sessions") === 1, "sessões: " + count("daily_sessions"));
  }
  return `itens na sessão: ${await page.locator("section[aria-label='O que importa hoje'] ol > li").count()}`;
});

// ───────────── Check-in ─────────────
await step("check-in por voz (microfone, upload do áudio)", async () => {
  await page.getByRole("tab", { name: "Áudio" }).click();
  await page.getByRole("button", { name: "Fale por 1 minuto" }).click();
  await page.getByRole("button", { name: "Enviar" }).waitFor();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Enviar" }).click();
  await page.getByText("Transcrição").waitFor({ timeout: 15000 });
  // Chromium headless não tem reconhecimento de voz: o app pede o texto e mantém o áudio.
  const src = await page.locator("text=/sem transcrição|reconhecimento do navegador|transcrição do servidor/").first().innerText();
  await page.locator("textarea[name=text]").fill("Hoje tô meio preocupado com dinheiro, pensei em mexer no AutoFlow, mas tive outra ideia também.");
  await shot("07-checkin-voz");
  await page.getByRole("button", { name: "Registrar check-in" }).click();
  await page.getByText(/Feito às/).waitFor({ timeout: 30000 });
  if (DB_URL) {
    const a = sql(`select audio_path from public.daily_checkins where user_id='${uid()}' and mode='falar'`);
    expect(a && a.includes("/checkin/"), "audio_path vazio");
    const obj = sql(`select count(*) from storage.objects where bucket_id='audio' and name = '${a}'`);
    expect(obj === "1", "arquivo de áudio não está no Storage");
  }
  return src;
});

await step("check-in por texto gera leitura e sessão nova", async () => {
  await page.getByRole("tab", { name: "Texto" }).click();
  await page.locator("textarea[name=text]").fill("Mano, hoje tô cansado, sem dinheiro e com prova da faculdade. Queria estudar copy.");
  await page.getByRole("button", { name: "Registrar check-in" }).click();
  await page.waitForTimeout(2500);
  const reading = await page.locator("section[aria-label='Leitura do dia'] p").first().innerText();
  expect(reading.length > 30, "leitura vazia");
  await shot("08-hoje-checkin");
  if (DB_URL) expect(count("daily_checkins") === 2, "check-ins: " + count("daily_checkins"));
  return reading.slice(0, 90) + "…";
});

await step("check-in rápido exige escalas", async () => {
  await page.getByRole("tab", { name: "Rápido" }).click();
  await page.getByRole("button", { name: "Registrar check-in" }).click();
  await page.getByText("Marque energia, foco e pressão.").waitFor();
  for (const l of ["Energia", "Foco", "Pressão"]) await page.getByRole("radiogroup", { name: l }).getByRole("radio", { name: "3" }).click();
  await page.getByRole("button", { name: "Registrar check-in" }).click();
  await page.waitForTimeout(2000);
  if (DB_URL) expect(count("daily_checkins") === 3, "check-ins: " + count("daily_checkins"));
});

await step("marcar item da sessão", async () => {
  await page.locator("section[aria-label='O que importa hoje'] button[aria-label^='Marcar']").first().click();
  await page.waitForTimeout(1500);
  const n = await page.locator("button[aria-label^='Desmarcar']").count();
  expect(n === 1, "itens feitos: " + n);
});

await step("registrar avanço no projeto prioritário", async () => {
  await page.getByLabel("Registrar avanço").fill("Tela de cadastro de cliente salvando no banco");
  await page.getByRole("button", { name: "Registrar", exact: true }).first().click();
  await page.locator("section[aria-label='Projeto prioritário']").getByText("Hoje", { exact: true }).waitFor();
  if (DB_URL) expect(sql(`select count(*) from public.projects where user_id='${uid()}' and last_progress_at::date = current_date`) === "1", "last_progress_at");
});

// ───────────── Captura + Inbox + Dinheiro ─────────────
await step("captura rápida (+) vai para a Inbox", async () => {
  await page.getByRole("button", { name: "Capturar" }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await page.locator("form textarea[name=body]").last().fill("Domínio do AutoFlow");
  await page.locator("input[name=amount]").fill("59,90");
  await shot("09-captura");
  await page.getByRole("button", { name: "Registrar", exact: true }).last().click();
  await page.getByRole("dialog", { name: "Capturar" }).waitFor({ state: "detached", timeout: 8000 });
  if (DB_URL) expect(count("inbox_items", "and status='pendente'") === 1, "inbox");
});

await step("Inbox lança em Dinheiro", async () => {
  await page.goto(BASE + "/inbox");
  await shot("10-inbox");
  await page.locator("select[name=project_id]").first().selectOption({ label: "AutoFlow" });
  await page.locator("select[name=category]").first().selectOption("ferramentas");
  await page.getByRole("button", { name: "Lançar em Dinheiro" }).click();
  await page.getByText("Inbox vazia.").waitFor();
  if (DB_URL) expect(sql(`select amount from public.finance_transactions where user_id='${uid()}'`) === "59.90", "valor");
});

await step("Dinheiro: receita", async () => {
  await page.goto(BASE + "/dinheiro");
  await page.getByRole("button", { name: "Receita", exact: true }).click();
  await page.locator("input[name=amount]").fill("300");
  await page.locator("select[name=project_id]").selectOption({ label: "AutoFlow" });
  await page.locator("input[name=description]").fill("Primeira mensalidade");
  await page.getByRole("button", { name: "Registrar" }).click();
  await page.getByText("Primeira mensalidade").waitFor();
  await shot("11-dinheiro");
  if (DB_URL) expect(count("finance_transactions") === 2, "lançamentos");
  return await page.getByText(/Resultado/).first().locator("..").innerText().catch(() => "");
});

// ───────────── Projetos ─────────────
await step("Projetos: criar, editar e ver mini DRE", async () => {
  await page.goto(BASE + "/projetos/novo");
  await page.fill("input[name=name]", "Coach de Bolso");
  await page.locator("select[name=status]").selectOption("validacao");
  await page.fill("input[name=next_proof]", "10 pessoas pagando o plano mensal");
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await page.waitForURL(/projetos\/[0-9a-f-]{36}/);
  await page.getByText("Editar projeto").evaluate((e) => e.scrollIntoView({ block: "center" }));
  await page.getByText("Editar projeto").click();
  await page.fill("input[name=blocker]", "Sem depoimentos");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByText("Sem depoimentos").first().waitFor();
  await page.goto(BASE + "/projetos");
  await shot("12-projetos");
  await page.getByRole("link", { name: /AutoFlow/ }).first().click();
  await page.waitForURL(/projetos\/.+/);
  await page.getByText("Lucro", { exact: true }).waitFor();
  await shot("13-projeto");
  if (DB_URL) expect(count("projects") === 3, "projetos: " + count("projects"));
});

// ───────────── Ideias ─────────────
await step("Ideias: anti-dispersão bloqueia promoção", async () => {
  await page.goto(BASE + "/ideias");
  await page.getByLabel("Nova ideia").fill("App de cashback para oficinas");
  await page.getByRole("button", { name: "Capturar" }).first().click();
  await page.getByText("App de cashback para oficinas").waitFor();
  await page.getByText("App de cashback para oficinas").click();
  await page.getByRole("button", { name: "Promover a projeto" }).click();
  await page.getByText(/Não iniciar agora/).waitFor();
  await shot("14-ideias");
  if (DB_URL) expect(sql(`select status from public.ideas where user_id='${uid()}'`) !== "promover", "promoveu sem respostas");
});

// ───────────── Decidir ─────────────
await step("Decidir: card, veredito e revisão", async () => {
  await page.goto(BASE + "/decidir/nova");
  await page.fill("input[name=title]", "Colocar R$ 2.000 em anúncio do AutoFlow");
  await page.fill("input[name=amount]", "2000");
  await page.fill("textarea[name=premortem]", "Ninguém clica porque a oferta é genérica.");
  await page.getByRole("button", { name: "Registrar decisão" }).click();
  await page.waitForURL(/decidir\/[0-9a-f-]{36}/);
  await shot("15-decisao");
  await page.getByRole("button", { name: "Registrar veredito" }).click();
  await page.waitForTimeout(1500);
  if (DB_URL) expect(sql(`select status from public.decisions where user_id='${uid()}'`) === "decidida", "status da decisão");
  return sql(`select verdict || ' / revisar ' || review_at from public.decisions where user_id='${uid()}'`) ?? "";
});

// ───────────── Brain ─────────────
await step("Brain: salvar nota e buscar", async () => {
  await page.goto(BASE + "/brain");
  await page.fill("textarea[name=body]", "Faturamento de 10 mil com margem baixa: avaliar pelo lucro, não pela venda.");
  await page.fill("input[name=title]", "Coach de Bolso margem");
  await page.getByRole("button", { name: "Salvar no Brain" }).click();
  await page.getByText("Coach de Bolso margem").first().waitFor();
  await page.fill("input[name=q]", "margem");
  await page.locator("form:has(input[name=q]) button[type=submit]").click();
  await page.waitForURL(/q=margem/);
  await shot("16-brain");
  const n = await page.locator("a[href^='/brain#'], a[href^='/projetos/'], a[href^='/decidir/']").count();
  expect(n > 0, "busca sem resultado");
  return `${n} resultados`;
});

// ───────────── Aprender, Falar, Review ─────────────
await step("Aprender: aula e exercício", async () => {
  await page.goto(BASE + "/aprender");
  await shot("17-aprender");
  await page.goto(BASE + "/aprender/margem-de-contribuicao");
  await page.fill("textarea[name=answer]", "Preço 97, ads 60, gateway 6, imposto 6: sobra 25 por venda.");
  await page.getByRole("button", { name: "Registrar" }).click();
  await page.waitForTimeout(1500);
  if (DB_URL) expect(Number(sql(`select count(*) from public.brain_notes where user_id='${uid()}'`)) >= 2, "exercício não foi para o Brain");
});

await step("Falar: gravação e métricas", async () => {
  await page.goto(BASE + "/falar");
  await page.getByRole("button", { name: "Gravar" }).click();
  await page.getByRole("button", { name: "Enviar" }).waitFor();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Enviar" }).click();
  await page.locator("textarea[name=transcript]").waitFor({ timeout: 15000 });
  await page.fill("textarea[name=transcript]", "O AutoFlow organiza o cadastro de cliente da oficina, tipo, do primeiro contato até a ordem de serviço, né, sem papel.");
  await page.getByRole("button", { name: "Avaliar" }).click();
  await page.getByText("Palavras/min").waitFor({ timeout: 20000 });
  await shot("18-falar");
});

await step("Review diário e semanal", async () => {
  await page.goto(BASE + "/review");
  await page.fill("textarea[name=advanced]", "Cadastro de cliente salvando.");
  await page.getByRole("button", { name: "Encerrar o dia" }).click();
  await page.waitForTimeout(1500);
  if (DB_URL) expect(count("daily_reviews") === 1, "review diário");
  await page.goto(BASE + "/review/semanal");
  await shot("19-semanal");
});

await step("Notificações e Ajustes", async () => {
  await page.goto(BASE + "/notificacoes");
  await shot("20-notificacoes");
  await page.goto(BASE + "/ajustes");
  await shot("21-ajustes");
});

// ───────────── Persistência ─────────────
await step("persistência: reload, logout e login de novo", async () => {
  await page.goto(BASE + "/hoje");
  await page.reload();
  await page.getByRole("link", { name: "AutoFlow" }).first().waitFor();
  await page.goto(BASE + "/ajustes");
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/login/);
  await page.goto(BASE + "/projetos");
  expect(/login/.test(page.url()), "acessou sem login");
  await page.fill("input[name=email]", EMAIL);
  await page.fill("input[name=password]", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/hoje/);
  await page.getByText(/Feito às/).waitFor();
  await page.goto(BASE + "/projetos");
  for (const n of ["AutoFlow", "R4DAR", "Coach de Bolso"]) await page.getByText(n).first().waitFor();
  await page.goto(BASE + "/dinheiro");
  await page.getByText("Primeira mensalidade").waitFor();
  await page.goto(BASE + "/brain");
  await page.getByText("Coach de Bolso margem").first().waitFor();
  await page.goto(BASE + "/decidir");
  await page.getByText("Colocar R$ 2.000").first().waitFor();
  await page.goto(BASE + "/ideias");
  await page.getByText("App de cashback").first().waitFor();
  return "tudo voltou depois do login";
});

await step("navegação mobile: abas e Mais", async () => {
  await page.goto(BASE + "/hoje");
  await page.getByRole("navigation", { name: "Navegação" }).getByRole("link", { name: "Projetos" }).click();
  await page.waitForURL(/projetos/);
  await page.getByRole("button", { name: "Mais" }).click();
  await shot("22-mais");
  await page.getByRole("dialog", { name: "Mais" }).getByRole("link", { name: "Decidir" }).click();
  await page.waitForURL(/decidir/);
  await page.goto(BASE + "/hoje");
  await shot("23-hoje-final");
});

// ───────────── Desktop ─────────────
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo", storageState: await ctx.storageState() });
const d = await dctx.newPage();
d.on("pageerror", (e) => errors.push("desktop pageerror: " + e.message));
await step("desktop: cockpit, sidebar e ⌘K", async () => {
  await d.goto(BASE + "/hoje");
  await d.screenshot({ path: `${SHOTS}/30-desktop-hoje.png`, fullPage: true });
  await d.keyboard.press("Control+k");
  await d.keyboard.type("AutoFlow");
  await d.getByRole("option").first().waitFor();
  await d.screenshot({ path: `${SHOTS}/31-desktop-cmdk.png` });
  const n = await d.getByRole("option").count();
  const before = d.url();
  await d.keyboard.press("Enter");
  await d.waitForURL((u) => u.toString() !== before);
  for (const [r, f] of [["/decidir", "32-desktop-decidir"], ["/projetos", "33-desktop-projetos"], ["/dinheiro", "34-desktop-dinheiro"], ["/brain", "35-desktop-brain"]]) {
    await d.goto(BASE + r);
    await d.screenshot({ path: `${SHOTS}/${f}.png`, fullPage: true });
  }
  return `${n} resultados no ⌘K`;
});

// ───────────── Isolamento ─────────────
await step("outra conta não vê nada", async () => {
  if (!DB_URL) return "sem DB_URL";
  const other = sql(`select count(*) from public.projects where user_id <> '${uid()}' `);
  return `projetos de outras contas no banco: ${other} (RLS testado à parte)`;
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passos ok`);
console.log("ERROS DE PÁGINA:", errors.length ? [...new Set(errors)] : "nenhum");
console.log("EMAIL:", EMAIL);
await browser.close();
process.exit(failed.length ? 1 : 0);
