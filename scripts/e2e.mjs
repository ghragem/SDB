// Teste ponta a ponta (mobile + desktop + dark). Uso: E2E_EMAIL=... E2E_PASSWORD=... BASE_URL=http://localhost:3000 node scripts/e2e.mjs
import { chromium, devices } from "playwright";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? "e2e-shots";
const EMAIL = process.env.E2E_EMAIL, PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error("Defina E2E_EMAIL e E2E_PASSWORD de uma conta de teste já confirmada e sem onboarding.");
const log = (...a) => console.log("•", ...a);
const errors = [];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ ...devices["iPhone 14"], locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });

// Login errado
await page.goto(BASE + "/hoje");
log("redirect →", page.url());
await page.fill('input[name=email]', EMAIL);
await page.fill('input[name=password]', "errada123");
await page.click('button[type=submit]');
await page.getByText("E-mail ou senha incorretos.").waitFor();
log("wrong password message ok");
await shot("01-login");
await page.fill('input[name=password]', PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL(/onboarding/);
log("onboarding →", page.url());

// Onboarding
await page.getByRole("button", { name: "Decidir melhor com dinheiro" }).click();
await page.getByRole("button", { name: "Terminar o que começo" }).click();
await shot("02-onb-1");
await page.getByRole("button", { name: "Continuar" }).click();
await page.getByRole("button", { name: "+ AutoFlow" }).click();
await page.getByLabel("Próxima prova").first().fill("1 oficina usando o cadastro de cliente");
await page.getByRole("button", { name: "+ R4DAR" }).click();
await shot("03-onb-2");
await page.getByRole("button", { name: "Continuar" }).click();
await page.getByRole("button", { name: "Execução" }).click();
await page.getByRole("button", { name: "Vendas" }).click();
await page.getByRole("button", { name: "Continuar" }).click();
await page.getByRole("button", { name: "Começo coisa nova antes de terminar" }).click();
await page.getByRole("button", { name: "Continuar" }).click();
await shot("04-onb-5");
await page.getByRole("button", { name: "Concluir" }).click();
await page.waitForURL(/\/hoje/, { timeout: 30000 });
log("after onboarding →", page.url());
await shot("05-hoje-inicial");
log("session items:", await page.locator("ol > li").count());

// Check-in escrito
await page.getByRole("button", { name: "Escrever" }).click();
await page.locator("textarea[name=text]").fill("Mano, hoje tô meio preocupado com dinheiro, pensei em mexer no AutoFlow, mas tive outra ideia também. Tenho faculdade e queria estudar copy.");
await page.getByRole("button", { name: "Registrar check-in" }).click();
await page.getByText("Leitura do dia").waitFor({ timeout: 30000 });
await page.waitForTimeout(800);
const reading = await page.locator("p.text-\\[17px\\]").first().innerText();
log("reading:", reading);
await shot("06-hoje-checkin");

// marcar item como feito
await page.getByRole("button", { name: "Marcar como feito" }).first().click();
await page.waitForTimeout(1200);
log("done items:", await page.getByRole("button", { name: "Desmarcar" }).count());

// Registrar avanço
await page.getByLabel("Registrar avanço").fill("Tela de cadastro de cliente salvando no banco");
await page.getByRole("button", { name: "Registrar" }).last().click();
await page.getByText("avançou hoje").waitFor();
log("progress registered");

// Quick capture
await page.getByRole("button", { name: "Capturar" }).click();
await page.getByRole("button", { name: "Despesa", exact: true }).click();
await page.locator("form textarea[name=body]").last().fill("Domínio do AutoFlow");
await page.locator("input[name=amount]").fill("59,90");
await shot("07-capture");
await page.getByRole("button", { name: "Registrar", exact: true }).last().click();
await page.waitForTimeout(1500);
log("capture dialog open after save:", await page.getByRole("dialog", { name: "Capturar" }).count());

// Inbox → lançar em dinheiro
await page.goto(BASE + "/inbox");
await page.locator('select[name=project_id]').first().selectOption({ label: "AutoFlow" });
await page.locator('select[name=category]').first().selectOption("ferramentas");
await page.getByRole("button", { name: "Lançar em Dinheiro" }).click();
await page.getByText("Inbox vazia.").waitFor();
log("inbox routed");

// Dinheiro: receita
await page.goto(BASE + "/dinheiro");
await page.getByRole("button", { name: "Receita", exact: true }).click();
await page.locator("input[name=amount]").fill("300");
await page.locator("select[name=project_id]").selectOption({ label: "AutoFlow" });
await page.locator("input[name=description]").fill("Primeira mensalidade");
await page.getByRole("button", { name: "Registrar" }).click();
await page.getByText("Primeira mensalidade").waitFor();
await shot("08-dinheiro");
log("money ok");

// Projeto detalhe
await page.goto(BASE + "/projetos");
await shot("09-projetos");
await page.getByRole("link", { name: /AutoFlow/ }).first().click();
await page.waitForURL(/projetos\/.+/);
await shot("10-projeto");
log("mini DRE lucro visible:", await page.getByText("Lucro", { exact: true }).count());

// Ideias: capturar e tentar promover sem respostas
await page.goto(BASE + "/ideias");
await page.locator("input[name=title]").fill("App de cashback para oficinas");
await page.getByRole("button", { name: "Capturar" }).first().click();
await page.getByText("App de cashback para oficinas").waitFor();
await page.getByText("App de cashback para oficinas").click();
await page.getByRole("button", { name: "Promover a projeto" }).click();
await page.getByText(/Não iniciar agora/).waitFor();
await shot("11-ideias");
log("anti-dispersão blocked promotion");

// Decisão
await page.goto(BASE + "/decidir/nova");
await page.locator("input[name=title]").fill("Colocar R$ 2.000 em anúncio do AutoFlow");
await page.locator("input[name=amount]").fill("2000");
await page.locator("textarea[name=premortem]").fill("Ninguém clica porque a oferta é genérica.");
await page.getByRole("button", { name: "Registrar decisão" }).click();
await page.waitForURL(/decidir\/[0-9a-f-]{36}/);
await shot("12-decisao");
log("flags:", await page.locator("ul li").count());
await page.getByRole("button", { name: "Registrar veredito" }).click();
await page.waitForTimeout(1500);
log("verdict badge:", await page.locator("h1 + div span").first().innerText());

// Brain
await page.goto(BASE + "/brain");
await page.locator("textarea[name=body]").fill("Faturamento de 10 mil com margem baixa: avaliar pelo lucro, não pela venda.");
await page.locator("input[name=title]").fill("Coach de Bolso margem");
await page.getByRole("button", { name: "Salvar no Brain" }).click();
await page.getByText("Coach de Bolso margem").waitFor();
await page.locator('input[name=q]').fill("margem");
await page.getByRole("button", { name: "Buscar" }).click();
await page.waitForURL(/q=margem/);
await shot("13-brain");
log("brain search hits:", await page.locator("a[href^='/brain#']").count());

// Aprender
await page.goto(BASE + "/aprender");
await shot("14-aprender");
// Falar (sem microfone em headless: só renderização)
await page.goto(BASE + "/falar");
await shot("15-falar");
// Review
await page.goto(BASE + "/review");
await page.locator("textarea[name=advanced]").fill("Cadastro de cliente salvando.");
await page.getByRole("button", { name: "Encerrar o dia" }).click();
await page.waitForTimeout(1200);
await page.goto(BASE + "/review/semanal");
await shot("16-semanal");
await page.goto(BASE + "/notificacoes");
await shot("17-notificacoes");
await page.goto(BASE + "/ajustes");
await shot("18-ajustes");

// Persistência: refresh + logout + login
await page.goto(BASE + "/hoje");
await page.reload();
log("after reload priority:", await page.getByRole("link", { name: "AutoFlow" }).count());
await page.goto(BASE + "/ajustes");
await page.getByRole("button", { name: "Sair" }).click();
await page.waitForURL(/login/);
await page.goto(BASE + "/projetos");
log("after logout →", page.url());
await page.fill('input[name=email]', EMAIL);
await page.fill('input[name=password]', PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL(/hoje/);
log("relogin ok; reading still there:", await page.getByText("Leitura do dia").count());

// Desktop
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo", storageState: await ctx.storageState() });
const d = await dctx.newPage();
d.on("pageerror", (e) => errors.push("desktop pageerror: " + e.message));
await d.goto(BASE + "/hoje");
await d.screenshot({ path: `${SHOTS}/20-desktop-hoje.png`, fullPage: false });
await d.keyboard.press("Control+k");
await d.keyboard.type("AutoFlow");
await d.waitForTimeout(1200);
await d.screenshot({ path: `${SHOTS}/21-desktop-cmdk.png` });
log("cmdk options:", await d.getByRole("option").count());
await d.keyboard.press("Escape");
await d.goto(BASE + "/decidir");
await d.screenshot({ path: `${SHOTS}/22-desktop-decidir.png`, fullPage: true });

// Dark mode mobile
const dk = await browser.newContext({ ...devices["iPhone 14"], colorScheme: "dark", storageState: await ctx.storageState() });
const dp = await dk.newPage();
await dp.goto(BASE + "/hoje");
await dp.screenshot({ path: `${SHOTS}/23-dark-hoje.png`, fullPage: true });

console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
