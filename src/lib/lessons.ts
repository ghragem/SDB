// Aulas curtas (5–15 min) da V1. Conteúdo conceitual, sem números inventados.
// O exemplo ligado à vida do Gustavo usa só o que ele contou no briefing.

export type Lesson = {
  slug: string;
  title: string;
  area: string;
  minutes: number;
  concept: string;
  simple: string;
  example: string;
  inYourLife: string;
  exercise: string;
  reviewInDays: number;
  /** Sinais que tornam a aula relevante agora */
  why: string;
};

export const LESSONS: Lesson[] = [
  {
    slug: "margem-de-contribuicao",
    title: "Faturamento não é lucro: margem de contribuição",
    area: "Finanças",
    minutes: 8,
    concept:
      "Margem de contribuição é quanto sobra de cada venda depois dos custos que só existem porque a venda aconteceu.",
    simple:
      "Preço de venda menos custos variáveis (anúncio por venda, taxa do gateway, imposto, reembolso, comissão). O que sobra paga os custos fixos. Só depois disso existe lucro.",
    example:
      "Produto de R$ 97. Taxa de gateway R$ 6, imposto R$ 6, custo de anúncio por venda R$ 60. Margem de contribuição: R$ 25 por venda, ou 25,8%. Mil vendas parecem R$ 97 mil. Na prática são R$ 25 mil antes de ferramentas, equipe e reembolsos.",
    inYourLife:
      "Você contou que um produto chegou perto de R$ 10–12 mil em vendas e a margem final ficou baixa. A pergunta certa nunca foi quanto vendeu, e sim quanto sobrou por venda depois de Ads, gateway e reembolso.",
    exercise:
      "Pegue um produto seu (real). Escreva: preço, custo de anúncio por venda, taxa do gateway, imposto, reembolso médio. Calcule a margem de contribuição por venda em reais e em %. Se não souber algum número, escreva 'não sei' em vez de chutar.",
    reviewInDays: 3,
    why: "Aparece quando há preocupação com dinheiro ou venda sendo tratada como vitória.",
  },
  {
    slug: "custo-de-oportunidade",
    title: "Custo de oportunidade: o que a ideia nova tira de você",
    area: "Decisão",
    minutes: 7,
    concept:
      "Custo de oportunidade é o valor da melhor alternativa que você abandona quando escolhe algo.",
    simple:
      "Toda hora colocada numa ideia nova é uma hora que não foi para o projeto que já estava andando. A ideia nova não compete com o nada; compete com o que você já começou.",
    example:
      "Você tem 10 horas livres na semana. Projeto A está a uma validação de ter cliente pagante. Ideia B é empolgante, mas ainda não tem nenhuma evidência. Colocar 6 horas em B custa, no mínimo, adiar a primeira prova real de A.",
    inYourLife:
      "Você mesmo apontou o padrão: o AutoFlow já recebeu tempo e atenção e ainda não chegou a cliente e receita recorrente. Cada ideia nova precisa responder qual projeto vai perder tempo por causa dela.",
    exercise:
      "Escreva a última ideia que te empolgou. Responda: qual projeto perderia tempo? Quantas horas? O que esse projeto deixaria de provar nesse período? Depois diga se ainda vale.",
    reviewInDays: 5,
    why: "Aparece quando surge ideia nova enquanto existe projeto ativo.",
  },
  {
    slug: "aversao-a-perda",
    title: "Aversão à perda: decidir com medo sem perceber",
    area: "Psicologia da decisão",
    minutes: 8,
    concept:
      "Aversão à perda é a tendência de sentir uma perda com mais força do que um ganho do mesmo tamanho (Kahneman e Tversky, Teoria da Perspectiva, 1979).",
    simple:
      "Com medo, você recusa apostas boas e às vezes segura apostas ruins para não 'realizar' a perda. O medo não some. O que dá para fazer é transformar medo em regra: limite de perda, prazo e critério de parada definidos antes.",
    example:
      "Uma campanha perdeu R$ 300. Com aversão à perda, a tendência é colocar mais R$ 300 para 'recuperar'. Com regra prévia ('paro se o CPA passar de X depois de R$ 300 gastos'), a decisão já estava tomada antes da emoção.",
    inYourLife:
      "Você disse que está numa fase com mais medo de perder dinheiro. Isso é informação, não defeito. A resposta não é coragem: é teste pequeno, perda máxima definida e critério de parada escrito antes de gastar.",
    exercise:
      "Pense numa decisão de dinheiro que você está adiando. Escreva: valor máximo que aceita perder, prazo, métrica, e o número exato que faria você parar. Se não conseguir escrever, a decisão ainda não está pronta.",
    reviewInDays: 4,
    why: "Aparece quando a pressão está alta ou há decisão financeira pendente.",
  },
  {
    slug: "pitch-60-segundos",
    title: "Pitch de 60 segundos: problema antes de ferramenta",
    area: "Oratória e vendas",
    minutes: 6,
    concept:
      "Um pitch curto funciona quando o ouvinte reconhece o próprio problema nos primeiros segundos.",
    simple:
      "Estrutura: 1) problema que ele sente, 2) o que isso custa para ele, 3) o que você faz (uma frase), 4) uma prova, 5) um pedido claro. Funcionalidade só entra se responder ao problema.",
    example:
      "Ruim: 'O sistema tem ordem de serviço, estoque, financeiro e WhatsApp.' Melhor: 'Quantos orçamentos você perde porque demorou para responder? O sistema monta e envia o orçamento pelo WhatsApp em dois minutos. Posso instalar na sua oficina esta semana e você testa por 14 dias.'",
    inYourLife:
      "Para o AutoFlow, o ouvinte é um dono de oficina sem tempo. Ele não quer saber da arquitetura. Ele quer saber se vai perder menos serviço e cobrar com menos dor de cabeça.",
    exercise:
      "Grave em Falar: explique seu projeto prioritário para um dono de oficina em até 60 segundos, seguindo as 5 partes. Depois veja quanto tempo levou para chegar ao problema.",
    reviewInDays: 2,
    why: "Aparece quando um projeto precisa de cliente ou validação.",
  },
  {
    slug: "hipotese-e-criterio-de-parada",
    title: "Erro útil: hipótese, limite e critério de parada",
    area: "Execução",
    minutes: 9,
    concept:
      "Um experimento transforma uma aposta em aprendizado: hipótese explícita, custo máximo, métrica, prazo, quando parar e quando escalar.",
    simple:
      "Erro ruim é perder sem saber por quê. Erro útil é perder pouco, dentro de um limite escolhido antes, e sair sabendo algo que muda a próxima decisão.",
    example:
      "Hipótese: 'Donos de oficina pagam R$ 99/mês por orçamento via WhatsApp.' Limite: 10 horas e R$ 0 em anúncio. Métrica: quantos aceitam testar. Prazo: 14 dias. Parada: menos de 2 de 15 conversas aceitam. Escala: 4 ou mais aceitam e 1 paga.",
    inYourLife:
      "Ter aprendido que faturamento não é lucro custou dinheiro. Próximos aprendizados podem custar menos se cada teste tiver limite e critério escritos antes de começar.",
    exercise:
      "Escreva um experimento para o seu projeto prioritário com os 6 campos: hipótese, valor máximo, métrica, prazo, parada, escala. Registre como decisão em Decidir se envolver dinheiro.",
    reviewInDays: 5,
    why: "Aparece quando há projeto em validação ou decisão de investimento.",
  },
];

export function lessonBySlug(slug: string) {
  return LESSONS.find((l) => l.slug === slug) ?? null;
}
