# Saindo do Bairro — V1

Sistema operacional pessoal do Gustavo. Pensar melhor. Decidir melhor. Executar melhor.

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres + Auth + Storage, RLS em todas as tabelas) · PWA.

## Rodar

```bash
npm install
cp .env.example .env.local   # preencha as duas variáveis públicas do Supabase
npm run dev                  # http://localhost:3000
```

Variáveis públicas do projeto Supabase `saindo-do-bairro` (região São Paulo):

```
NEXT_PUBLIC_SUPABASE_URL=https://xjtwaodxxgkemkfpkjex.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_N2mn-L1Xx5Iq-VbgsM1zlQ_KrUQz3Qi
```

A chave publicável é feita para ficar no navegador; quem protege os dados é o RLS. Chaves de IA ficam só no servidor (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`), nunca com prefixo `NEXT_PUBLIC_`, nunca no Git.

Sem chave de IA o app funciona inteiro: leitura do dia e sessão saem do motor de regras e a interface diz isso. Com chave, a IA refina usando o contexto salvo no banco.

### Supabase: ajustes no painel (uma vez)

1. Authentication → URL Configuration: coloque a URL de produção em **Site URL** e `https://SEU-DOMINIO/auth/callback` em **Redirect URLs**.
2. Authentication → Providers → Email: deixe "Confirm email" ligado.
3. Authentication → Policies: ligue **Leaked password protection** (o advisor de segurança aponta isso).

As migrações em `supabase/migrations/` já foram aplicadas no projeto.

## O que existe na V1

| Área | O que funciona |
|---|---|
| Login | E-mail e senha, criar conta com confirmação, logout. Proxy redireciona quem não está logado. |
| Onboarding | 5 passos (melhorar, projetos, habilidades, problemas, modo realidade, padrão "muito direto"). Gera a primeira sessão para a Home nunca abrir vazia. Carrega as 5 regras pré-definidas. |
| Hoje | Pulso (Falar, Escrever, Rápido), leitura do dia, 3–5 itens da sessão com check, projeto prioritário com próxima prova, bloqueio e dias sem progresso, registro de avanço, próxima decisão, dinheiro do mês, finalizar sessão. |
| Check-in | Voz grava áudio (Storage privado) e transcreve pelo reconhecimento do navegador; se não houver, tenta o servidor (OpenAI, se configurado); senão pede o texto. Estados Ataque, Normal, Sobrevivência. |
| Projetos | CRUD, 8 estados, próxima prova, bloqueio, linha do tempo de avanços, dias sem progresso reais, mini DRE por projeto, decisões e experimentos ligados. Nenhuma porcentagem inventada. |
| Ideias | Captura, regra anti-dispersão com as 7 perguntas. Promoção a projeto bloqueada sem respostas ou quando a própria resposta é "novidade". |
| Decidir | Decision Card completo, pre-mortem, checagem de lacunas por regras, sugestão de veredito, veredito com confiança e data de revisão, decisão contra a recomendação, experimento com critério de parada e escala, revisão previsão x realidade que vira aprendizado no Brain. "Destrua minha ideia" e "Eu estou viajando?" (precisam de IA). |
| Brain + Inbox | Notas tipadas (fato, análise, hipótese, opinião), regras que aprendemos, busca full-text em português em notas, projetos, ideias, decisões, avanços e check-ins. "+" em qualquer tela captura; a Inbox classifica para Ideia, Decisão, Brain, Projeto ou Dinheiro. |
| Aprender | 5 aulas curtas com a estrutura da seção 19, recomendadas pelo check-in, exercício salvo, revisão agendada. |
| Falar | Grava, transcreve, mede duração, palavras por minuto e vícios de linguagem; compara com o treino anterior. Nota e feedback qualitativo com IA. |
| Dinheiro | Lançamento manual, entrou, saiu, resultado, investido, caixa, margem, lucro por projeto. |
| Review | Diário (3 perguntas) e semanal (números da semana + continuar, parar, começar, prioridade). |
| Notificações | Calculadas dos dados: projeto parado ≥ 5 dias, decisão a revisar, hipótese vencida, ideia sem avaliação, inbox pendente, revisão semanal. |
| Ajustes | Nome, modo realidade, provider preferido, status real da IA e integrações (todas "EM BREVE"). |
| PWA | Manifest standalone, ícones, apple-touch-icon, safe areas, service worker com cache de assets e tela offline. Páginas com dados nunca vão para cache. |

Busca global: `⌘K` / `Ctrl+K` no desktop, lupa no mobile.

## Arquitetura

```
src/
  proxy.ts                 sessão Supabase + redirecionamento (Next 16 usa proxy no lugar de middleware)
  lib/supabase/            clientes server, browser e proxy
  lib/day.ts               motor de regras do dia (estado, leitura, prioridade, sessão)
  lib/session.ts           monta e salva a sessão (regras sempre, IA quando houver)
  lib/ai/provider.ts       interface AIProvider: generate/analyze/evaluate/summarize/extract
  lib/ai/anthropic.ts      Claude (SDK oficial)
  lib/ai/openai.ts         OpenAI (REST) + transcrição
  lib/ai/intelligence.ts   camada única de inteligência: seleção de contexto, prompts, log em ai_interactions
  lib/checks.ts            anti-bullshit por regras para decisões
  lib/notifications.ts     central de notificações
  lib/lessons.ts           aulas da V1
  app/(app)/...            telas autenticadas
supabase/migrations/       schema, RLS, busca, storage
scripts/e2e.mjs            teste ponta a ponta (Playwright)
```

Todas as 40 tabelas da seção 76 existem com `id, user_id, created_at, updated_at, status, metadata`, RLS por dono e índices. As tabelas de P1/P2 (radar, imóveis, FAC, copy, vendas…) têm colunas específicas em `data` até a feature ser construída.

## Testes

- `npm run build` e `npm run lint` passam.
- RLS verificado no banco: outro usuário não vê nem busca dados alheios, e insert com `user_id` alheio é bloqueado.
- Trigger de avanço, criação de perfil e busca em português verificados no banco.
- `scripts/e2e.mjs` cobre login errado, onboarding, check-in, sessão, avanço, captura, inbox, dinheiro, ideias, decisão, brain, review, refresh, logout e login, desktop com ⌘K e modo escuro.

## Backlog (visão completa no briefing)

P0 restantes: notificações push, importação de conversa, gravação de áudio offline.
P1: Radar, Imóveis, Negócios, pesquisa externa, vídeos recomendados, FAC, Copy Lab, Sales Lab, Escrita avançada.
P2: integrações (Calendar, Drive, Gmail, Ads, WhatsApp, financeiro, marketplaces).
