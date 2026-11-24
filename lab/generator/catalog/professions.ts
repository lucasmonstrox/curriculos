import type { Area } from "@/domain/resume";
import type { CatalogSector } from "./sectors";

/*
 * As profissões dos currículos sintéticos, já no formato padronizado que a extração entrega: cargo
 * e habilidade com nome consistente. O gabarito é feito em cima destas profissões.
 *
 * Nas atividades, {product} vira um produto do setor sorteado, {n} um número e {pct} uma porcentagem.
 */

export type Profession = {
  /**
   * A profissão em minúsculas, como no campo `occupation` da extração: é o nome que entra no resumo
   * ("5 anos como desenvolvedor backend") e nos relatórios do gabarito.
   */
  occupation: string;
  area: Area;
  titles: readonly string[];
  skills: readonly string[];
  activities: readonly string[];
  /** Frases de foco, como no campo `focus` da extração; fecham o resumo. */
  focus: readonly string[];
  courses: readonly string[];
  certifications: readonly string[];
  /** Chance relativa de ser sorteada. */
  weight: number;
  /** Setores possíveis, quando a profissão não existe em qualquer setor (enfermagem só na saúde). */
  sectors?: readonly CatalogSector[];
  /** Formação técnica em vez de superior. */
  technicalEducation?: true;
  /** Só trabalho presencial. */
  onsiteOnly?: true;
};

export const PROFESSIONS = {
  backend: {
    occupation: "desenvolvedor backend",
    area: "technology",
    titles: ["Desenvolvedor Backend", "Engenheiro de Software Backend", "Desenvolvedor Java", "Desenvolvedor Node.js"],
    skills: [
      "Node.js",
      "TypeScript",
      "Java",
      "Go",
      "PostgreSQL",
      "Docker",
      "AWS",
      "APIs REST",
      "Microsserviços",
      "Kafka",
      "Spring Boot",
      "NestJS",
      "Testes automatizados",
      "Redis",
      "GraphQL",
    ],
    activities: [
      "Construiu as APIs de {product} usadas pelo app e pelo site.",
      "Reduziu o tempo de resposta das rotas de {product} em {pct}%.",
      "Migrou o sistema monolítico de {product} para microsserviços.",
      "Integrou {n} parceiros externos por API.",
      "Cuidou da modelagem do banco de {product} e das consultas mais pesadas.",
      "Escreveu testes automatizados e subiu a cobertura para {pct}%.",
    ],
    focus: ["Foco em APIs, integrações e banco de dados.", "Foco em performance e arquitetura de sistemas."],
    courses: [
      "Ciência da Computação",
      "Análise e Desenvolvimento de Sistemas",
      "Sistemas de Informação",
      "Engenharia de Computação",
    ],
    certifications: ["AWS Certified Developer", "Oracle Certified Java Programmer"],
    weight: 4,
  },
  frontend: {
    occupation: "desenvolvedor frontend",
    area: "technology",
    titles: ["Desenvolvedor Frontend", "Desenvolvedor React", "Engenheiro de Software Frontend"],
    skills: [
      "React",
      "TypeScript",
      "JavaScript",
      "CSS",
      "Next.js",
      "Acessibilidade",
      "Testes de interface",
      "Tailwind",
      "Vue.js",
      "Storybook",
      "Figma",
    ],
    activities: [
      "Desenvolveu as telas de {product} em React.",
      "Melhorou o carregamento das páginas de {product} em {pct}%.",
      "Criou uma biblioteca de componentes usada por {n} times.",
      "Corrigiu os problemas de acessibilidade do site de {product}.",
      "Transformou os protótipos do time de design em telas funcionando.",
    ],
    focus: ["Foco em interfaces rápidas e acessíveis.", "Foco em componentes e performance no navegador."],
    courses: ["Sistemas para Internet", "Ciência da Computação", "Design Digital"],
    certifications: ["Meta Front-End Developer"],
    weight: 3,
  },
  fullstack: {
    occupation: "desenvolvedor fullstack",
    area: "technology",
    titles: ["Desenvolvedor Fullstack", "Engenheiro de Software Fullstack", "Desenvolvedor Web"],
    skills: [
      "React",
      "Node.js",
      "TypeScript",
      "JavaScript",
      "PostgreSQL",
      "Next.js",
      "Prisma",
      "APIs REST",
      "Docker",
      "PHP",
      "Laravel",
    ],
    activities: [
      "Construiu do zero o sistema de {product}, da tela ao banco.",
      "Entregou {n} funcionalidades novas de {product} em um trimestre.",
      "Manteve o site e a API de {product}.",
      "Montou o painel administrativo de {product}.",
    ],
    focus: ["Faz front, back e um pouco de infraestrutura.", "Leva uma funcionalidade da tela até o banco de dados."],
    courses: ["Análise e Desenvolvimento de Sistemas", "Ciência da Computação"],
    certifications: [],
    weight: 3,
  },
  devops: {
    occupation: "engenheiro devops",
    area: "technology",
    titles: [
      "Engenheiro DevOps",
      "Engenheiro de Confiabilidade (SRE)",
      "Analista de Infraestrutura",
      "Engenheiro de Cloud",
    ],
    skills: [
      "AWS",
      "Docker",
      "Kubernetes",
      "Terraform",
      "Linux",
      "CI/CD",
      "GitHub Actions",
      "Observabilidade",
      "Prometheus",
      "Grafana",
      "Ansible",
      "Shell script",
    ],
    activities: [
      "Automatizou o deploy de {n} serviços com pipelines de CI/CD.",
      "Migrou a infraestrutura de {product} para Kubernetes.",
      "Reduziu o custo de nuvem em {pct}%.",
      "Montou o monitoramento e os alertas dos sistemas de {product}.",
      "Atuou no plantão de incidentes e baixou o tempo de recuperação em {pct}%.",
    ],
    focus: [
      "Foco em infraestrutura, nuvem e automação de deploy.",
      "Foco em manter os sistemas no ar com custo baixo.",
    ],
    courses: ["Redes de Computadores", "Ciência da Computação", "Engenharia de Computação"],
    certifications: ["AWS Solutions Architect", "CKA (Kubernetes)"],
    weight: 2,
  },
  "data-engineer": {
    occupation: "engenheiro de dados",
    area: "data",
    titles: ["Engenheiro de Dados", "Analista de Engenharia de Dados"],
    skills: ["Python", "SQL", "Spark", "Airflow", "AWS", "dbt", "Data lake", "ETL", "Kafka", "BigQuery", "Databricks"],
    activities: [
      "Montou os pipelines que levam os dados de {product} para o data lake.",
      "Orquestrou {n} rotinas de ETL no Airflow.",
      "Reduziu o tempo de processamento diário de {product} em {pct}%.",
      "Criou a camada de dados tratados usada pelos analistas.",
      "Colocou os eventos de {product} em tempo real com Kafka.",
    ],
    focus: ["Foco em pipelines de dados e data lake.", "Foco em deixar o dado limpo e disponível para análise."],
    courses: ["Ciência da Computação", "Engenharia de Computação", "Sistemas de Informação"],
    certifications: ["Google Professional Data Engineer", "Databricks Data Engineer"],
    weight: 2,
  },
  "data-scientist": {
    occupation: "cientista de dados",
    area: "data",
    titles: ["Cientista de Dados", "Analista de Machine Learning"],
    skills: [
      "Python",
      "SQL",
      "R",
      "Machine learning",
      "scikit-learn",
      "Estatística",
      "Modelos preditivos",
      "pandas",
      "Testes A/B",
      "XGBoost",
    ],
    activities: [
      "Criou um modelo para prever o cancelamento de clientes de {product}.",
      "Fez um modelo de previsão de demanda de {product} com erro {pct}% menor.",
      "Rodou {n} testes A/B e analisou os resultados.",
      "Colocou em produção um modelo de recomendação de {product}.",
      "Segmentou a base de clientes de {product} por comportamento.",
    ],
    focus: [
      "Foco em modelos de machine learning que viram produto.",
      "Foco em estatística aplicada a perguntas de negócio.",
    ],
    courses: ["Estatística", "Matemática Aplicada", "Engenharia de Produção", "Economia"],
    certifications: ["TensorFlow Developer", "Azure Data Scientist Associate"],
    weight: 2,
  },
  "data-analyst": {
    occupation: "analista de dados",
    area: "data",
    titles: ["Analista de Dados", "Analista de BI"],
    skills: [
      "SQL",
      "Power BI",
      "Excel",
      "Tableau",
      "Python",
      "Dashboards",
      "DAX",
      "Looker Studio",
      "Modelagem dimensional",
      "Indicadores de negócio",
    ],
    activities: [
      "Montou os dashboards de {product} usados pela diretoria.",
      "Automatizou o relatório mensal de {product}, que levava {n} dias.",
      "Definiu os indicadores de {product} com as áreas de negócio.",
      "Cruzou os dados de {product} e achou uma perda de {pct}% na operação.",
      "Atendia {n} áreas com pedidos de análise.",
    ],
    focus: ["Foco em dashboards e indicadores de negócio.", "Foco em SQL e ferramentas de BI."],
    courses: ["Administração", "Estatística", "Engenharia de Produção", "Gestão da Tecnologia da Informação"],
    certifications: ["PL-300 Power BI", "Google Data Analytics"],
    weight: 3,
  },
  "financial-analyst": {
    occupation: "analista financeiro",
    area: "finance",
    titles: ["Analista Financeiro", "Analista de Planejamento Financeiro", "Controller"],
    skills: [
      "Excel",
      "Power BI",
      "SAP",
      "Fluxo de caixa",
      "Orçamento",
      "DRE",
      "Conciliação bancária",
      "Modelagem financeira",
      "Análise de custos",
    ],
    activities: [
      "Fechava o orçamento anual da área de {product}.",
      "Montou o modelo de fluxo de caixa usado pela diretoria.",
      "Reduziu o prazo do fechamento mensal em {n} dias.",
      "Analisou os custos de {product} e cortou {pct}% de despesa.",
      "Fazia a conciliação bancária e o DRE do mês.",
    ],
    focus: ["Foco em planejamento financeiro e orçamento.", "Foco em análise de resultado e custos."],
    courses: ["Ciências Contábeis", "Economia", "Administração"],
    certifications: ["CPA-20", "CFA nível 1"],
    weight: 2,
  },
  designer: {
    occupation: "designer de produto",
    area: "design",
    titles: ["Product Designer", "UX Designer", "UI Designer"],
    skills: [
      "Figma",
      "Pesquisa com usuário",
      "Prototipação",
      "Design system",
      "Testes de usabilidade",
      "Adobe XD",
      "Jornada do usuário",
    ],
    activities: [
      "Redesenhou o fluxo de {product} e a conversão subiu {pct}%.",
      "Entrevistou {n} usuários para entender como usam {product}.",
      "Manteve o design system com os componentes do app.",
      "Desenhou o app de {product} do zero, da pesquisa ao protótipo.",
      "Rodou testes de usabilidade antes de cada lançamento.",
    ],
    focus: ["Foco em pesquisa com usuário e prototipação.", "Foco em design system e interfaces de produto."],
    courses: ["Design", "Design Gráfico", "Publicidade e Propaganda", "Arquitetura e Urbanismo"],
    certifications: ["Google UX Design"],
    weight: 2,
  },
  "product-manager": {
    occupation: "gerente de produto",
    area: "product",
    titles: ["Product Manager", "Product Owner", "Gerente de Produto"],
    skills: ["Jira", "Roadmap", "Descoberta de produto", "Métricas de produto", "OKRs", "Scrum", "Priorização"],
    activities: [
      "Definiu o roadmap de {product} com um time de {n} pessoas.",
      "Lançou a nova versão de {product} e o uso subiu {pct}%.",
      "Conversava com clientes toda semana para priorizar o que entrava.",
      "Organizava as cerimônias do time no Scrum.",
      "Acompanhava as métricas de {product} e decidia o que cortar.",
    ],
    focus: ["Foco em descoberta e priorização de produto.", "Faz a ponte entre negócio, design e tecnologia."],
    courses: ["Administração", "Engenharia de Produção", "Sistemas de Informação"],
    certifications: ["CSPO (Scrum Product Owner)", "PSPO"],
    weight: 2,
  },
  "customer-success": {
    occupation: "analista de sucesso do cliente",
    area: "sales",
    titles: ["Analista de Sucesso do Cliente", "Customer Success Manager", "Gerente de Contas"],
    skills: [
      "HubSpot",
      "Zendesk",
      "Excel",
      "Onboarding de clientes",
      "NPS",
      "Renovação de contratos",
      "Retenção",
      "Health score",
      "Atendimento ao cliente",
    ],
    activities: [
      "Cuidava de uma carteira de {n} clientes de {product}.",
      "Baixou o cancelamento de clientes em {pct}%.",
      "Fazia o onboarding dos clientes novos de {product}.",
      "Montou o processo de renovação de contratos.",
      "Acompanhava o NPS e ligava para os clientes insatisfeitos.",
    ],
    focus: ["Foco em retenção e carteira de clientes.", "Foco em onboarding e renovação de contratos."],
    courses: ["Administração", "Psicologia", "Marketing", "Relações Públicas"],
    certifications: ["HubSpot Service Hub"],
    weight: 2,
  },
  sales: {
    occupation: "executivo de vendas",
    area: "sales",
    titles: ["Executivo de Contas", "SDR", "Consultor Comercial"],
    skills: [
      "Salesforce",
      "HubSpot",
      "Excel",
      "Prospecção",
      "Negociação",
      "Funil de vendas",
      "Cold call",
      "Vendas consultivas",
      "CRM",
    ],
    activities: [
      "Bateu {pct}% acima da meta anual de vendas de {product}.",
      "Prospectava {n} empresas por semana.",
      "Fechou contratos de {product} com empresas grandes.",
      "Agendava reuniões para o time de vendas.",
      "Abriu a carteira de clientes de {product} numa região nova.",
    ],
    focus: ["Foco em vendas para empresas.", "Foco em prospecção, negociação e fechamento."],
    courses: ["Administração", "Marketing", "Relações Internacionais", "Gestão Comercial"],
    certifications: ["Salesforce Administrator"],
    weight: 2,
  },
  marketing: {
    occupation: "analista de marketing",
    area: "marketing",
    titles: ["Analista de Marketing Digital", "Analista de Growth", "Analista de Performance"],
    skills: [
      "Google Analytics",
      "Excel",
      "Canva",
      "Mídia paga",
      "SEO",
      "Meta Ads",
      "Google Ads",
      "E-mail marketing",
      "Funil de aquisição",
      "Copywriting",
    ],
    activities: [
      "Gerenciava a mídia paga de {product} com verba de R$ {n} mil por mês.",
      "Baixou o custo por cliente novo em {pct}%.",
      "Cuidou das redes sociais de {product}.",
      "Montou as campanhas de e-mail para a base de clientes.",
      "Analisava o funil de aquisição no Google Analytics.",
    ],
    focus: ["Foco em aquisição de clientes e mídia paga.", "Foco em funil de aquisição e campanhas."],
    courses: ["Marketing", "Publicidade e Propaganda", "Comunicação Social"],
    certifications: ["Google Ads", "Meta Blueprint"],
    weight: 2,
  },
  people: {
    occupation: "analista de RH",
    area: "people",
    titles: ["Analista de RH", "Recrutador", "Business Partner de RH"],
    skills: [
      "Excel",
      "Recrutamento e seleção",
      "Entrevista por competências",
      "Clima organizacional",
      "Folha de pagamento",
      "LinkedIn Recruiter",
      "Integração de funcionários",
    ],
    activities: [
      "Contratou {n} pessoas em um ano.",
      "Conduzia a pesquisa de clima da empresa.",
      "Reduziu o tempo de contratação em {pct}%.",
      "Cuidava da integração dos funcionários novos.",
      "Apoiava os gestores na avaliação de desempenho.",
    ],
    focus: ["Foco em recrutamento e seleção.", "Foco em clima e desenvolvimento de pessoas."],
    courses: ["Psicologia", "Gestão de Recursos Humanos", "Administração"],
    certifications: [],
    weight: 1,
  },
  nursing: {
    occupation: "enfermeiro",
    area: "health",
    titles: ["Enfermeiro", "Técnico de Enfermagem", "Enfermeiro Supervisor"],
    skills: [
      "UTI",
      "Pronto-socorro",
      "Administração de medicamentos",
      "Gestão de equipe de enfermagem",
      "Segurança do paciente",
    ],
    activities: [
      "Atendimento a pacientes na UTI.",
      "Supervisionava {n} técnicos de enfermagem por plantão.",
      "Implantou o protocolo de segurança do paciente na ala.",
      "Controlava os indicadores de infecção hospitalar.",
      "Plantões de 12 horas no pronto-socorro.",
    ],
    focus: ["Foco em terapia intensiva.", "Foco em cuidado ao paciente e gestão de equipe."],
    courses: ["Enfermagem"],
    certifications: ["COREN ativo", "ACLS"],
    weight: 1,
    sectors: ["health"],
    onsiteOnly: true,
  },
  maintenance: {
    occupation: "técnico de manutenção",
    area: "industry",
    titles: ["Técnico em Manutenção", "Eletricista Industrial", "Mecânico de Manutenção"],
    skills: ["NR-10", "NR-35", "CLP", "Painéis elétricos", "Manutenção preventiva", "Leitura de diagramas"],
    activities: [
      "Manutenção preventiva e corretiva das máquinas da linha.",
      "Montagem de painéis elétricos.",
      "Reduziu as paradas de máquina em {pct}%.",
      "Programação básica de CLP.",
      "Trabalho em turno e em altura.",
    ],
    focus: ["Foco em manutenção elétrica industrial.", "Foco em máquinas, painéis e motores."],
    courses: ["Técnico em Eletrotécnica", "Técnico em Mecânica"],
    certifications: ["NR-10", "NR-35"],
    weight: 1,
    sectors: ["industry"],
    technicalEducation: true,
    onsiteOnly: true,
  },
} as const satisfies Record<string, Profession>;

export type ProfessionId = keyof typeof PROFESSIONS;

export const PROFESSION_IDS = Object.keys(PROFESSIONS) as ProfessionId[];

/** Lido como `Profession` (com os campos opcionais), para quem não precisa do tipo literal de cada uma. */
export const professionOf = (id: ProfessionId): Profession => PROFESSIONS[id];

/** Pares de profissões vizinhas: dividem habilidade ou trabalho, mas não são a mesma. */
export const NEIGHBORS: readonly (readonly [ProfessionId, ProfessionId])[] = [
  ["backend", "fullstack"],
  ["frontend", "fullstack"],
  ["backend", "devops"],
  ["backend", "data-engineer"],
  ["devops", "data-engineer"],
  ["data-engineer", "data-scientist"],
  ["data-engineer", "data-analyst"],
  ["data-scientist", "data-analyst"],
  ["data-analyst", "financial-analyst"],
  ["data-analyst", "marketing"],
  ["frontend", "designer"],
  ["designer", "product-manager"],
  ["customer-success", "sales"],
  ["sales", "marketing"],
];

export const neighborsOf = (id: ProfessionId): ProfessionId[] =>
  NEIGHBORS.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
