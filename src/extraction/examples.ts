import type { ExtractedResume } from "../domain/resume";

/*
 * Exemplos (few-shot) que vão no prompt antes do currículo de verdade: o texto bruto, do jeito que
 * chega, e a ficha esperada. Cada um ensina um caso difícil:
 *
 *   1. Bagunça de escrita: abreviações ("Dev Back-end Sr.", "node + ts"), datas como "mar/2021" e
 *      "2016 - 2017", habilidades espalhadas nas atividades, e um emprego de outra profissão
 *      (sites em PHP) que ganha `occupation` próprio.
 *   2. Troca de carreira: enfermeira por 10 anos que fez um curso de dados. O emprego mais recente é
 *      um projeto de curso; datas só com o ano; pós sem instituição (null); sem telefone.
 *   3. Carreira mista sem contato: vendas, suporte e sucesso do cliente, um freelance ao mesmo tempo
 *      que outro emprego, graduação incompleta e pretensão salarial ("R$ 9.000,00" vira 900000).
 *
 * As fichas esperadas são tipadas (o compilador confere o formato) e o teste extraction.test.ts
 * passa todas pelo schema. Os nomes são fictícios e os e-mails usam @example.com.
 */

/** O "hoje" dos exemplos: as datas deles foram escritas pensando neste mês. */
export const EXAMPLES_REFERENCE_MONTH = "2026-11";

export type ExtractionExample = { text: string; expected: ExtractedResume };

export const EXTRACTION_EXAMPLES: readonly ExtractionExample[] = [
  {
    text: `RAFAEL M. LIMA
rafael.lima@example.com | (11) 90000-1001 | São Paulo/SP

Dev Back-end Sr., a maior parte da carreira em fintech.

EXPERIÊNCIA
PagaLeve (fintech) - Engenheiro de Software Sênior
mar/2021 - atual
* lidero o back do Pix, node + typescript, kafka, postgres
* baixei a latência p99 de 900ms p/ 180ms

Banco Aurora - Dev Backend Pleno
jan/2018 a fev/2021
* APIs REST de conciliação bancária na AWS (lambda, sqs, rds)

Agência Pixel - Programador Jr
2016 - 2017
* sites em PHP e JS para clientes

FORMAÇÃO
Bacharelado em Ciência da Computação - USP (2015)

SKILLS: node, ts, javascript, postgres, aws, docker, kafka, redis, microserviços, testes
Inglês avançado. Prefiro remoto ou híbrido, CLT.`,
    expected: {
      personal: {
        name: "Rafael M. Lima",
        email: "rafael.lima@example.com",
        phone: "(11) 90000-1001",
        city: "São Paulo",
        state: "SP",
      },
      headline: "Engenheiro de Software Backend",
      area: "technology",
      seniority: "senior",
      focus: "Foco em sistemas de pagamento, APIs e banco de dados.",
      skills: [
        "Node.js",
        "TypeScript",
        "JavaScript",
        "PostgreSQL",
        "AWS",
        "Docker",
        "Kafka",
        "Redis",
        "Microsserviços",
        "Testes automatizados",
        "PHP",
      ],
      experiences: [
        {
          title: "Engenheiro de Software Backend Sênior",
          occupation: "desenvolvedor backend",
          company: "PagaLeve",
          sector: "finance",
          start: "2021-03",
          end: null,
          activities: [
            "Lidera o backend do Pix em Node.js e TypeScript, com Kafka e PostgreSQL.",
            "Reduziu a latência p99 de 900 ms para 180 ms.",
          ],
        },
        {
          title: "Desenvolvedor Backend Pleno",
          occupation: "desenvolvedor backend",
          company: "Banco Aurora",
          sector: "finance",
          start: "2018-01",
          end: "2021-02",
          activities: ["Construiu APIs REST de conciliação bancária na AWS (Lambda, SQS e RDS)."],
        },
        {
          title: "Programador Júnior",
          occupation: "desenvolvedor web",
          company: "Agência Pixel",
          sector: "services",
          start: "2016-01",
          end: "2017-12",
          activities: ["Desenvolveu sites em PHP e JavaScript para clientes."],
        },
      ],
      education: [{ course: "Ciência da Computação", institution: "USP", level: "bachelor", completedIn: 2015 }],
      certifications: [],
      languages: [
        { language: "Português", level: "native" },
        { language: "Inglês", level: "advanced" },
      ],
      preferences: {
        workModels: ["remote", "hybrid"],
        contract: "clt",
        availability: null,
        salaryExpectationCents: null,
      },
    },
  },
  {
    text: `Simone Batista Correia
Salvador - BA · simone.correia@example.com

Objetivo: vaga de analista de dados júnior (área da saúde, de preferência)

Sou enfermeira há mais de 10 anos e estou migrando pra dados. Fiz bootcamp de 6 meses em 2026.

Experiência
- Projeto final do bootcamp DadosJá (abr a set de 2026): painel no Power BI do tempo de espera no pronto-socorro com dados abertos do SUS.
- Hospital Bem Viver, Enfermeira Supervisora da UTI, 2018 até março de 2026: supervisão de 20 técnicos; planilhas de indicadores de infecção e ocupação de leitos pra diretoria.
- Hospital Bem Viver, Enfermeira assistencial, 2016 a 2017.

Formação: Enfermagem (UFBA, 2015). Pós em Terapia Intensiva (2018).
Conhecimentos: SQL, Power BI, Excel avançado, python básico (pandas)
COREN ativo. Inglês básico. Disponível imediatamente, aceito remoto.`,
    expected: {
      personal: {
        name: "Simone Batista Correia",
        email: "simone.correia@example.com",
        phone: null,
        city: "Salvador",
        state: "BA",
      },
      headline: "Analista de Dados",
      area: "data",
      seniority: "junior",
      focus: "Busca vaga de analista de dados júnior, de preferência na área da saúde.",
      skills: [
        "SQL",
        "Power BI",
        "Excel",
        "Python",
        "pandas",
        "Indicadores hospitalares",
        "Gestão de equipe de enfermagem",
        "Terapia intensiva",
      ],
      experiences: [
        {
          title: "Analista de Dados (projeto de bootcamp)",
          occupation: "analista de dados",
          company: "DadosJá",
          sector: "education",
          start: "2026-04",
          end: "2026-09",
          activities: [
            "Montou um painel no Power BI com o tempo de espera no pronto-socorro, a partir de dados abertos do SUS.",
          ],
        },
        {
          title: "Enfermeira Supervisora",
          occupation: "enfermeira",
          company: "Hospital Bem Viver",
          sector: "health",
          start: "2018-01",
          end: "2026-03",
          activities: [
            "Supervisionava 20 técnicos de enfermagem na UTI.",
            "Montava as planilhas de indicadores de infecção e ocupação de leitos para a diretoria.",
          ],
        },
        {
          title: "Enfermeira",
          occupation: "enfermeira",
          company: "Hospital Bem Viver",
          sector: "health",
          start: "2016-01",
          end: "2017-12",
          activities: ["Atuava na enfermagem assistencial."],
        },
      ],
      education: [
        { course: "Enfermagem", institution: "UFBA", level: "bachelor", completedIn: 2015 },
        { course: "Especialização em Terapia Intensiva", institution: null, level: "postgraduate", completedIn: 2018 },
      ],
      certifications: ["COREN ativo"],
      languages: [
        { language: "Português", level: "native" },
        { language: "Inglês", level: "basic" },
      ],
      preferences: { workModels: ["remote"], contract: null, availability: "immediate", salaryExpectationCents: null },
    },
  },
  {
    text: `CURRÍCULO

Diego Albuquerque
Belo Horizonte, MG

Resumo: profissional de vendas B2B e sucesso do cliente em empresas de software.

GestãoFácil Software
  Customer Success Manager (fev/2022 - hoje)
  Carteira de 60 contas médias. Criei um health score que antecipa risco de churn; o churn mensal caiu de 3% para 1,8%.
  Analista de Suporte (out/2020 - jan/2022)
  Atendimento por chat e telefone.

NuvemERP - Executivo de Vendas (2017-2020)
  Vendas consultivas de ERP para a indústria, meta batida 3 anos seguidos. Usava Salesforce.

Freelance (2019-2020): consultoria de CRM HubSpot para pequenas empresas.

Graduação em Administração - Unip (incompleto)
Pretensão: R$ 9.000,00 | PJ ou CLT | remoto`,
    expected: {
      personal: { name: "Diego Albuquerque", email: null, phone: null, city: "Belo Horizonte", state: "MG" },
      headline: "Customer Success Manager",
      area: "sales",
      seniority: "mid",
      focus: "Foco em retenção de clientes e vendas B2B de software.",
      skills: [
        "HubSpot",
        "Salesforce",
        "Vendas consultivas",
        "Gestão de carteira",
        "Health score",
        "Retenção de clientes",
        "Atendimento ao cliente",
        "CRM",
      ],
      experiences: [
        {
          title: "Customer Success Manager",
          occupation: "gerente de sucesso do cliente",
          company: "GestãoFácil Software",
          sector: "software",
          start: "2022-02",
          end: null,
          activities: [
            "Cuida de uma carteira de 60 contas médias.",
            "Criou um health score que antecipa o risco de cancelamento.",
            "Reduziu o cancelamento mensal de 3% para 1,8%.",
          ],
        },
        {
          title: "Analista de Suporte",
          occupation: "analista de suporte",
          company: "GestãoFácil Software",
          sector: "software",
          start: "2020-10",
          end: "2022-01",
          activities: ["Atendia clientes por chat e telefone."],
        },
        {
          title: "Consultor de CRM (freelance)",
          occupation: "consultor de CRM",
          company: "Autônomo",
          sector: "services",
          start: "2019-01",
          end: "2020-12",
          activities: ["Prestou consultoria de CRM HubSpot para pequenas empresas."],
        },
        {
          title: "Executivo de Vendas",
          occupation: "executivo de vendas",
          company: "NuvemERP",
          sector: "software",
          start: "2017-01",
          end: "2020-12",
          activities: ["Fazia vendas consultivas de ERP para a indústria.", "Bateu a meta 3 anos seguidos."],
        },
      ],
      education: [{ course: "Administração", institution: "Unip", level: "incomplete-bachelor", completedIn: null }],
      certifications: [],
      languages: [{ language: "Português", level: "native" }],
      preferences: { workModels: ["remote"], contract: "any", availability: null, salaryExpectationCents: 900_000 },
    },
  },
];
