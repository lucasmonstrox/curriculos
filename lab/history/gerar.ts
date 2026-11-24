// Gera currículos fictícios para testar a recomendação, já no formato padronizado que o modelo de
// linguagem vai entregar depois de ler o currículo original: cargo, habilidade e campos com nome
// consistente. O que é sorteado é a carreira: de 2 a 7 experiências, às vezes passando por 2 ou 3
// profissões (vizinhas ou nada a ver). O gabarito guarda quantos meses cada um passou em cada profissão.
//
// Uso: bun gerar.ts [--n 40] [--semente 7]   (a mesma semente gera sempre os mesmos currículos)

const arg = (nome: string, padrao: number) => {
  const i = Bun.argv.indexOf(`--${nome}`);
  return i > 0 ? Number(Bun.argv[i + 1]) : padrao;
};
const N = arg("n", 40);
const SEMENTE = arg("semente", 7);

// Sorteio com semente (mulberry32), para o conjunto ser reproduzível.
let estado = SEMENTE >>> 0;
const rand = () => {
  estado = (estado + 0x6d2b79f5) >>> 0;
  let t = estado;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const chance = (p: number) => rand() < p;
const um = <T>(l: readonly T[]): T => l[Math.floor(rand() * l.length)]!;
const entre = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const embaralhar = <T>(l: readonly T[]): T[] => {
  const c = [...l];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [c[i], c[j]] = [c[j]!, c[i]!];
  }
  return c;
};
const alguns = <T>(l: readonly T[], k: number): T[] => embaralhar(l).slice(0, Math.min(k, l.length));
function pesado<T>(pares: [T, number][]): T {
  let r = rand() * pares.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of pares) {
    r -= w;
    if (r < 0) return v;
  }
  return pares.at(-1)![0];
}

type Profissao = {
  area: string;
  titulos: string[];
  habilidades: string[]; // nome padronizado
  atividades: string[]; // {p} = produto do setor, {n} = número, {pct} = porcentagem
  foco: string[]; // frase de foco para o resumo
  cursos: string[];
  certificacoes: string[];
  peso: number; // chance relativa de ser sorteada
  setores?: string[]; // só quando a profissão não existe em qualquer setor
};

const PROFISSOES: Record<string, Profissao> = {
  backend: {
    area: "tecnologia",
    titulos: ["Desenvolvedor Backend", "Engenheiro de Software Backend", "Desenvolvedor Java", "Desenvolvedor Node.js"],
    habilidades: ["Node.js", "TypeScript", "Java", "Go", "PostgreSQL", "Docker", "AWS", "APIs REST", "Microsserviços", "Kafka", "Spring Boot", "NestJS", "Testes automatizados", "Redis", "GraphQL"],
    atividades: [
      "Construiu as APIs de {p} usadas pelo app e pelo site.",
      "Reduziu o tempo de resposta das rotas de {p} em {pct}%.",
      "Migrou o sistema monolítico de {p} para microsserviços.",
      "Integrou {n} parceiros externos por API.",
      "Cuidou da modelagem do banco de {p} e das consultas mais pesadas.",
      "Escreveu testes automatizados e subiu a cobertura para {pct}%.",
    ],
    foco: ["Foco em APIs, integrações e banco de dados.", "Foco em performance e arquitetura de sistemas."],
    cursos: ["Ciência da Computação", "Análise e Desenvolvimento de Sistemas", "Sistemas de Informação", "Engenharia de Computação"],
    certificacoes: ["AWS Certified Developer", "Oracle Certified Java Programmer"],
    peso: 4,
  },
  frontend: {
    area: "tecnologia",
    titulos: ["Desenvolvedor Frontend", "Desenvolvedor React", "Engenheiro de Software Frontend"],
    habilidades: ["React", "TypeScript", "JavaScript", "CSS", "Next.js", "Acessibilidade", "Testes de interface", "Tailwind", "Vue.js", "Storybook", "Figma"],
    atividades: [
      "Desenvolveu as telas de {p} em React.",
      "Melhorou o carregamento das páginas de {p} em {pct}%.",
      "Criou uma biblioteca de componentes usada por {n} times.",
      "Corrigiu os problemas de acessibilidade do site de {p}.",
      "Transformou os protótipos do time de design em telas funcionando.",
    ],
    foco: ["Foco em interfaces rápidas e acessíveis.", "Foco em componentes e performance no navegador."],
    cursos: ["Sistemas para Internet", "Ciência da Computação", "Design Digital"],
    certificacoes: ["Meta Front-End Developer"],
    peso: 3,
  },
  fullstack: {
    area: "tecnologia",
    titulos: ["Desenvolvedor Fullstack", "Engenheiro de Software Fullstack", "Desenvolvedor Web"],
    habilidades: ["React", "Node.js", "TypeScript", "JavaScript", "PostgreSQL", "Next.js", "Prisma", "APIs REST", "Docker", "PHP", "Laravel"],
    atividades: [
      "Construiu do zero o sistema de {p}, da tela ao banco.",
      "Entregou {n} funcionalidades novas de {p} em um trimestre.",
      "Manteve o site e a API de {p}.",
      "Montou o painel administrativo de {p}.",
    ],
    foco: ["Faz front, back e um pouco de infraestrutura.", "Leva uma funcionalidade da tela até o banco de dados."],
    cursos: ["Análise e Desenvolvimento de Sistemas", "Ciência da Computação"],
    certificacoes: [],
    peso: 3,
  },
  devops: {
    area: "tecnologia",
    titulos: ["Engenheiro DevOps", "Engenheiro de Confiabilidade (SRE)", "Analista de Infraestrutura", "Engenheiro de Cloud"],
    habilidades: ["AWS", "Docker", "Kubernetes", "Terraform", "Linux", "CI/CD", "GitHub Actions", "Observabilidade", "Prometheus", "Grafana", "Ansible", "Shell script"],
    atividades: [
      "Automatizou o deploy de {n} serviços com pipelines de CI/CD.",
      "Migrou a infraestrutura de {p} para Kubernetes.",
      "Reduziu o custo de nuvem em {pct}%.",
      "Montou o monitoramento e os alertas dos sistemas de {p}.",
      "Atuou no plantão de incidentes e baixou o tempo de recuperação em {pct}%.",
    ],
    foco: ["Foco em infraestrutura, nuvem e automação de deploy.", "Foco em manter os sistemas no ar com custo baixo."],
    cursos: ["Redes de Computadores", "Ciência da Computação", "Engenharia de Computação"],
    certificacoes: ["AWS Solutions Architect", "CKA (Kubernetes)"],
    peso: 2,
  },
  eng_dados: {
    area: "dados",
    titulos: ["Engenheiro de Dados", "Analista de Engenharia de Dados"],
    habilidades: ["Python", "SQL", "Spark", "Airflow", "AWS", "dbt", "Data lake", "ETL", "Kafka", "BigQuery", "Databricks"],
    atividades: [
      "Montou os pipelines que levam os dados de {p} para o data lake.",
      "Orquestrou {n} rotinas de ETL no Airflow.",
      "Reduziu o tempo de processamento diário de {p} em {pct}%.",
      "Criou a camada de dados tratados usada pelos analistas.",
      "Colocou os eventos de {p} em tempo real com Kafka.",
    ],
    foco: ["Foco em pipelines de dados e data lake.", "Foco em deixar o dado limpo e disponível para análise."],
    cursos: ["Ciência da Computação", "Engenharia de Computação", "Sistemas de Informação"],
    certificacoes: ["Google Professional Data Engineer", "Databricks Data Engineer"],
    peso: 2,
  },
  cientista_dados: {
    area: "dados",
    titulos: ["Cientista de Dados", "Analista de Machine Learning"],
    habilidades: ["Python", "SQL", "R", "Machine learning", "scikit-learn", "Estatística", "Modelos preditivos", "pandas", "Testes A/B", "XGBoost"],
    atividades: [
      "Criou um modelo para prever o cancelamento de clientes de {p}.",
      "Fez um modelo de previsão de demanda de {p} com erro {pct}% menor.",
      "Rodou {n} testes A/B e analisou os resultados.",
      "Colocou em produção um modelo de recomendação de {p}.",
      "Segmentou a base de clientes de {p} por comportamento.",
    ],
    foco: ["Foco em modelos de machine learning que viram produto.", "Foco em estatística aplicada a perguntas de negócio."],
    cursos: ["Estatística", "Matemática Aplicada", "Engenharia de Produção", "Economia"],
    certificacoes: ["TensorFlow Developer", "Azure Data Scientist Associate"],
    peso: 2,
  },
  analista_dados: {
    area: "dados",
    titulos: ["Analista de Dados", "Analista de BI"],
    habilidades: ["SQL", "Power BI", "Excel", "Tableau", "Python", "Dashboards", "DAX", "Looker Studio", "Modelagem dimensional", "Indicadores de negócio"],
    atividades: [
      "Montou os dashboards de {p} usados pela diretoria.",
      "Automatizou o relatório mensal de {p}, que levava {n} dias.",
      "Definiu os indicadores de {p} com as áreas de negócio.",
      "Cruzou os dados de {p} e achou uma perda de {pct}% na operação.",
      "Atendia {n} áreas com pedidos de análise.",
    ],
    foco: ["Foco em dashboards e indicadores de negócio.", "Foco em SQL e ferramentas de BI."],
    cursos: ["Administração", "Estatística", "Engenharia de Produção", "Gestão da Tecnologia da Informação"],
    certificacoes: ["PL-300 Power BI", "Google Data Analytics"],
    peso: 3,
  },
  analista_financeiro: {
    area: "financas",
    titulos: ["Analista Financeiro", "Analista de Planejamento Financeiro", "Controller"],
    habilidades: ["Excel", "Power BI", "SAP", "Fluxo de caixa", "Orçamento", "DRE", "Conciliação bancária", "Modelagem financeira", "Análise de custos"],
    atividades: [
      "Fechava o orçamento anual da área de {p}.",
      "Montou o modelo de fluxo de caixa usado pela diretoria.",
      "Reduziu o prazo do fechamento mensal em {n} dias.",
      "Analisou os custos de {p} e cortou {pct}% de despesa.",
      "Fazia a conciliação bancária e o DRE do mês.",
    ],
    foco: ["Foco em planejamento financeiro e orçamento.", "Foco em análise de resultado e custos."],
    cursos: ["Ciências Contábeis", "Economia", "Administração"],
    certificacoes: ["CPA-20", "CFA nível 1"],
    peso: 2,
  },
  designer: {
    area: "design",
    titulos: ["Product Designer", "UX Designer", "UI Designer"],
    habilidades: ["Figma", "Pesquisa com usuário", "Prototipação", "Design system", "Testes de usabilidade", "Adobe XD", "Jornada do usuário"],
    atividades: [
      "Redesenhou o fluxo de {p} e a conversão subiu {pct}%.",
      "Entrevistou {n} usuários para entender como usam {p}.",
      "Manteve o design system com os componentes do app.",
      "Desenhou o app de {p} do zero, da pesquisa ao protótipo.",
      "Rodou testes de usabilidade antes de cada lançamento.",
    ],
    foco: ["Foco em pesquisa com usuário e prototipação.", "Foco em design system e interfaces de produto."],
    cursos: ["Design", "Design Gráfico", "Publicidade e Propaganda", "Arquitetura e Urbanismo"],
    certificacoes: ["Google UX Design"],
    peso: 2,
  },
  pm: {
    area: "produto",
    titulos: ["Product Manager", "Product Owner", "Gerente de Produto"],
    habilidades: ["Jira", "Roadmap", "Descoberta de produto", "Métricas de produto", "OKRs", "Scrum", "Priorização"],
    atividades: [
      "Definiu o roadmap de {p} com um time de {n} pessoas.",
      "Lançou a nova versão de {p} e o uso subiu {pct}%.",
      "Conversava com clientes toda semana para priorizar o que entrava.",
      "Organizava as cerimônias do time no Scrum.",
      "Acompanhava as métricas de {p} e decidia o que cortar.",
    ],
    foco: ["Foco em descoberta e priorização de produto.", "Faz a ponte entre negócio, design e tecnologia."],
    cursos: ["Administração", "Engenharia de Produção", "Sistemas de Informação"],
    certificacoes: ["CSPO (Scrum Product Owner)", "PSPO"],
    peso: 2,
  },
  cs: {
    area: "comercial",
    titulos: ["Analista de Sucesso do Cliente", "Customer Success Manager", "Gerente de Contas"],
    habilidades: ["HubSpot", "Zendesk", "Excel", "Onboarding de clientes", "NPS", "Renovação de contratos", "Retenção", "Health score", "Atendimento ao cliente"],
    atividades: [
      "Cuidava de uma carteira de {n} clientes de {p}.",
      "Baixou o cancelamento de clientes em {pct}%.",
      "Fazia o onboarding dos clientes novos de {p}.",
      "Montou o processo de renovação de contratos.",
      "Acompanhava o NPS e ligava para os clientes insatisfeitos.",
    ],
    foco: ["Foco em retenção e carteira de clientes.", "Foco em onboarding e renovação de contratos."],
    cursos: ["Administração", "Psicologia", "Marketing", "Relações Públicas"],
    certificacoes: ["HubSpot Service Hub"],
    peso: 2,
  },
  vendas: {
    area: "comercial",
    titulos: ["Executivo de Contas", "SDR", "Consultor Comercial"],
    habilidades: ["Salesforce", "HubSpot", "Excel", "Prospecção", "Negociação", "Funil de vendas", "Cold call", "Vendas consultivas", "CRM"],
    atividades: [
      "Bateu {pct}% acima da meta anual de vendas de {p}.",
      "Prospectava {n} empresas por semana.",
      "Fechou contratos de {p} com empresas grandes.",
      "Agendava reuniões para o time de vendas.",
      "Abriu a carteira de clientes de {p} numa região nova.",
    ],
    foco: ["Foco em vendas para empresas.", "Foco em prospecção, negociação e fechamento."],
    cursos: ["Administração", "Marketing", "Relações Internacionais", "Gestão Comercial"],
    certificacoes: ["Salesforce Administrator"],
    peso: 2,
  },
  marketing: {
    area: "marketing",
    titulos: ["Analista de Marketing Digital", "Analista de Growth", "Analista de Performance"],
    habilidades: ["Google Analytics", "Excel", "Canva", "Mídia paga", "SEO", "Meta Ads", "Google Ads", "E-mail marketing", "Funil de aquisição", "Copywriting"],
    atividades: [
      "Gerenciava a mídia paga de {p} com verba de R$ {n} mil por mês.",
      "Baixou o custo por cliente novo em {pct}%.",
      "Cuidou das redes sociais de {p}.",
      "Montou as campanhas de e-mail para a base de clientes.",
      "Analisava o funil de aquisição no Google Analytics.",
    ],
    foco: ["Foco em aquisição de clientes e mídia paga.", "Foco em funil de aquisição e campanhas."],
    cursos: ["Marketing", "Publicidade e Propaganda", "Comunicação Social"],
    certificacoes: ["Google Ads", "Meta Blueprint"],
    peso: 2,
  },
  rh: {
    area: "pessoas",
    titulos: ["Analista de RH", "Recrutador", "Business Partner de RH"],
    habilidades: ["Excel", "Recrutamento e seleção", "Entrevista por competências", "Clima organizacional", "Folha de pagamento", "LinkedIn Recruiter", "Integração de funcionários"],
    atividades: [
      "Contratou {n} pessoas em um ano.",
      "Conduzia a pesquisa de clima da empresa.",
      "Reduziu o tempo de contratação em {pct}%.",
      "Cuidava da integração dos funcionários novos.",
      "Apoiava os gestores na avaliação de desempenho.",
    ],
    foco: ["Foco em recrutamento e seleção.", "Foco em clima e desenvolvimento de pessoas."],
    cursos: ["Psicologia", "Gestão de Recursos Humanos", "Administração"],
    certificacoes: [],
    peso: 1,
  },
  enfermagem: {
    area: "saude",
    titulos: ["Enfermeiro", "Técnico de Enfermagem", "Enfermeiro Supervisor"],
    habilidades: ["UTI", "Pronto-socorro", "Administração de medicamentos", "Gestão de equipe de enfermagem", "Segurança do paciente"],
    atividades: [
      "Atendimento a pacientes na UTI.",
      "Supervisionava {n} técnicos de enfermagem por plantão.",
      "Implantou o protocolo de segurança do paciente na ala.",
      "Controlava os indicadores de infecção hospitalar.",
      "Plantões de 12 horas no pronto-socorro.",
    ],
    foco: ["Foco em terapia intensiva.", "Foco em cuidado ao paciente e gestão de equipe."],
    cursos: ["Enfermagem"],
    certificacoes: ["COREN ativo", "ACLS"],
    peso: 1,
    setores: ["saude"],
  },
  manutencao: {
    area: "industria",
    titulos: ["Técnico em Manutenção", "Eletricista Industrial", "Mecânico de Manutenção"],
    habilidades: ["NR-10", "NR-35", "CLP", "Painéis elétricos", "Manutenção preventiva", "Leitura de diagramas"],
    atividades: [
      "Manutenção preventiva e corretiva das máquinas da linha.",
      "Montagem de painéis elétricos.",
      "Reduziu as paradas de máquina em {pct}%.",
      "Programação básica de CLP.",
      "Trabalho em turno e em altura.",
    ],
    foco: ["Foco em manutenção elétrica industrial.", "Foco em máquinas, painéis e motores."],
    cursos: ["Técnico em Eletrotécnica", "Técnico em Mecânica"],
    certificacoes: ["NR-10", "NR-35"],
    peso: 1,
    setores: ["industria"],
  },
};

// Profissões vizinhas: dividem habilidade ou trabalho, mas não são a mesma.
const VIZINHAS: [string, string][] = [
  ["backend", "fullstack"],
  ["frontend", "fullstack"],
  ["backend", "devops"],
  ["backend", "eng_dados"],
  ["devops", "eng_dados"],
  ["eng_dados", "cientista_dados"],
  ["eng_dados", "analista_dados"],
  ["cientista_dados", "analista_dados"],
  ["analista_dados", "analista_financeiro"],
  ["analista_dados", "marketing"],
  ["frontend", "designer"],
  ["designer", "pm"],
  ["cs", "vendas"],
  ["vendas", "marketing"],
];
const vizinhasDe = (p: string) => VIZINHAS.filter((v) => v.includes(p)).map(([a, b]) => (a === p ? b : a));

const SETORES: Record<string, { produtos: string[]; empresas: string[] }> = {
  financeiro: { produtos: ["pagamentos", "cartão de crédito", "empréstimo"], empresas: ["Banco Aurora", "PagaLeve", "Conta Fácil", "Crédito Já"] },
  varejo: { produtos: ["e-commerce", "estoque", "lojas físicas"], empresas: ["LojaMix", "Mercado Bom", "Atacarejo Central", "Moda Rio"] },
  saude: { produtos: ["agendamento de consultas", "prontuário", "convênios"], empresas: ["Hospital Bem Viver", "Clínica Vida Plena", "Rede Saúde Mais"] },
  educacao: { produtos: ["plataforma de cursos", "matrícula", "provas online"], empresas: ["Aprende+", "Escola Horizonte", "Faculdade Nova Era"] },
  telecom: { produtos: ["planos de celular", "internet residencial", "faturamento"], empresas: ["TelcoSul", "ConectaNet"] },
  industria: { produtos: ["linha de produção", "manutenção de fábrica", "compras de insumos"], empresas: ["Aço Capixaba", "Celulose Litoral", "Metalúrgica Paraná"] },
  seguros: { produtos: ["seguro auto", "sinistros", "cotação"], empresas: ["Seguros Horizonte", "Protege Seguros"] },
  software: { produtos: ["ERP em nuvem", "sistema de gestão", "app de delivery"], empresas: ["NuvemERP", "GestãoFácil Software", "Entrega Rápida"] },
  logistica: { produtos: ["entregas", "frota", "rastreamento de cargas"], empresas: ["TransLog", "Rota Certa"] },
};

// Frases de qualquer profissão: ruído que aproxima currículos diferentes.
const FRASES_GENERICAS = ["Trabalhava com metodologia ágil.", "Apresentava os resultados para a diretoria.", "Participou da contratação de pessoas para o time.", "Treinou os colegas novos."];
const CURSOS_GERAIS = ["Administração", "Engenharia de Produção", "Letras", "Economia", "Direito", "Ciências Biológicas"];
const POS = ["Gestão de Projetos", "Gestão Empresarial", "Data Science", "Marketing Digital", "Finanças", "Liderança"];
const INSTITUICOES = ["USP", "Unicamp", "UFMG", "UFRJ", "PUC-Rio", "Mackenzie", "Uninove", "Unip", "Fatec", "UFPR", "UFRGS", "UFBA", "UFPE", "Estácio", "Anhanguera", "FGV"];
const NOMES = ["Ana", "Bruno", "Carla", "Daniel", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Leonardo", "Mariana", "Natália", "Otávio", "Paula", "Rafael", "Sabrina", "Tiago", "Vitória", "Wagner", "Yasmin", "André", "Beatriz", "Caio", "Débora", "Fábio", "Helena", "Igor", "Juliana"];
const SOBRENOMES = ["Silva", "Souza", "Oliveira", "Santos", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Araújo", "Ribeiro", "Gomes", "Martins", "Rocha", "Barbosa", "Teixeira", "Moreira", "Cardoso"];
const CIDADES: [string, string][] = [
  ["São Paulo", "SP"], ["Campinas", "SP"], ["Rio de Janeiro", "RJ"], ["Belo Horizonte", "MG"], ["Curitiba", "PR"], ["Porto Alegre", "RS"], ["Florianópolis", "SC"],
  ["Recife", "PE"], ["Salvador", "BA"], ["Fortaleza", "CE"], ["Goiânia", "GO"], ["Brasília", "DF"], ["Vitória", "ES"], ["Manaus", "AM"],
];
const NIVEIS = ["estagio", "junior", "pleno", "senior", "especialista", "gestao"];
const SUFIXO: Record<string, string> = { estagio: "(estágio)", junior: "Júnior", pleno: "Pleno", senior: "Sênior", especialista: "Especialista", gestao: "(líder de time)" };
const PRETENSAO_BASE: Record<string, number> = { estagio: 200000, junior: 400000, pleno: 800000, senior: 1400000, especialista: 1800000, gestao: 1600000 }; // centavos

const AGORA = 2026 * 12 + 10; // novembro de 2026, contado em meses
const mes = (m: number) => `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`;
const legivel = (p: string) => p.replaceAll("_", " ");
const preencher = (frase: string, setor: string) =>
  frase
    .replaceAll("{p}", um(SETORES[setor]!.produtos))
    .replaceAll("{n}", String(entre(2, 60)))
    .replaceAll("{pct}", String(entre(5, 45)));
const nomesProf = Object.keys(PROFISSOES);
const sortearProfissao = (excluir: string[] = []) =>
  pesado(nomesProf.filter((p) => !excluir.includes(p)).map((p) => [p, PROFISSOES[p]!.peso] as [string, number]));

// Nível pelo tempo acumulado na profissão até o fim daquele emprego.
const nivelPorMeses = (m: number, primeiroEmprego: boolean) =>
  primeiroEmprego && m < 12 && chance(0.4) ? "estagio" : m < 24 ? "junior" : m < 60 ? "pleno" : m < 120 ? "senior" : "especialista";

// Sorteia a profissão de cada experiência, da mais antiga para a mais recente.
function trajetoria(): { profissoes: string[]; tipo: string } {
  const nExp = pesado<number>([[2, 12], [3, 12], [4, 13], [5, 13], [6, 25], [7, 25]]);
  const principal = sortearProfissao();
  let tipo = pesado<string>([["uma", 55], ["duas_vizinhas", 15], ["duas_nada_a_ver", 15], ["tres", 15]]);
  if (tipo === "tres" && nExp < 3) tipo = "duas_nada_a_ver";
  if (tipo === "uma") return { profissoes: Array(nExp).fill(principal), tipo };
  const viz = vizinhasDe(principal);
  const segunda = tipo === "duas_vizinhas" && viz.length ? um(viz) : sortearProfissao([principal, ...viz]);
  const blocos: [string, number][] = [];
  if (tipo === "tres") {
    const terceira = sortearProfissao([principal, segunda]);
    const k2 = entre(1, Math.max(1, Math.floor((nExp - 1) / 2)));
    blocos.push([segunda, k2], [terceira, 1], [principal, nExp - k2 - 1]);
  } else {
    const k2 = entre(1, Math.max(1, Math.floor(nExp / 2)));
    blocos.push([segunda, k2], [principal, nExp - k2]);
  }
  // Em geral a carreira anda em blocos (trocou de profissão e ficou); às vezes vai e volta.
  const ordem = embaralhar(blocos).flatMap(([p, k]) => Array(k).fill(p) as string[]);
  return { profissoes: chance(0.25) ? embaralhar(ordem) : ordem, tipo };
}

function candidato(i: number) {
  const id = `c${String(i + 1).padStart(2, "0")}`;
  const { profissoes, tipo } = trajetoria();
  const empregado = chance(0.8);

  // Datas: do emprego mais recente para trás.
  const duracoes = profissoes.map(() => entre(6, 40));
  let cursor = empregado ? AGORA : AGORA - entre(1, 8);
  const periodos: { inicio: number; fim: number | null }[] = Array(profissoes.length);
  for (let k = profissoes.length - 1; k >= 0; k--) {
    const fim = k === profissoes.length - 1 && empregado ? null : cursor;
    const inicio = cursor - duracoes[k]!;
    periodos[k] = { inicio, fim };
    cursor = inicio - entre(0, 4);
  }

  // Experiências na ordem do tempo, com o nível subindo conforme o tempo na profissão.
  const acumulado: Record<string, number> = {};
  const experiencias = profissoes.map((p, k) => {
    const prof = PROFISSOES[p]!;
    acumulado[p] = (acumulado[p] ?? 0) + duracoes[k]!;
    let nivel = nivelPorMeses(acumulado[p]!, k === 0);
    if ((nivel === "senior" || nivel === "especialista") && chance(0.2)) nivel = "gestao";
    const setor = um(prof.setores ?? Object.keys(SETORES));
    const atividades = alguns(prof.atividades, entre(2, 3)).map((a) => preencher(a, setor));
    if (chance(0.2)) atividades.push(um(FRASES_GENERICAS));
    return {
      profissao: p, // só para o gabarito; sai antes de gravar
      nivel,
      cargo: `${um(prof.titulos)} ${SUFIXO[nivel]}`,
      empresa: um(SETORES[setor]!.empresas),
      setor,
      inicio: mes(periodos[k]!.inicio),
      fim: periodos[k]!.fim === null ? null : mes(periodos[k]!.fim!),
      atividades,
    };
  });

  const atual = experiencias.at(-1)!;
  const profAtual = PROFISSOES[atual.profissao]!;
  const meses = acumulado;
  const totalMeses = Object.values(meses).reduce((a, b) => a + b, 0);
  const anos = Math.round(totalMeses / 12);
  const porTempo = Object.entries(meses).sort((a, b) => b[1] - a[1]);
  const maisTempo = PROFISSOES[porTempo[0]![0]]!;

  // Habilidades de cada profissão da carreira, mais numerosas para a que ocupou mais tempo.
  const habilidades = [...new Set(porTempo.flatMap(([p, m]) => alguns(PROFISSOES[p]!.habilidades, Math.max(1, Math.round((m / totalMeses) * entre(7, 11))))))];

  const outras = [...new Set(experiencias.map((e) => e.profissao))].filter((p) => p !== atual.profissao);
  const tituloAtual = um(profAtual.titulos);
  // O resumo diz o tempo em cada profissão: "Analista de Marketing com 7 anos" quando 5 deles foram em
  // dados é falso e infla o emprego atual. Os títulos saem na mesma ordem e quantidade de sorteios de
  // antes, para a mesma semente gerar os mesmos currículos e o antes e depois ser comparável.
  const tituloDe: Record<string, string> = { [atual.profissao]: tituloAtual.toLowerCase() };
  for (const p of outras) tituloDe[p] = um(PROFISSOES[p]!.titulos).toLowerCase();
  const tempo = (m: number) => (m < 12 ? "menos de 1 ano" : Math.round(m / 12) === 1 ? "1 ano" : `${Math.round(m / 12)} anos`);
  const resumo = [
    outras.length
      ? `${Math.max(1, anos)} anos de experiência: ${porTempo.map(([p, m]) => `${tempo(m)} como ${tituloDe[p]}`).join(", ")}. Hoje atua como ${tituloAtual.toLowerCase()}.`
      : `${tituloAtual} com ${Math.max(1, anos)} anos de experiência.`,
    um(profAtual.foco),
  ].join(" ");

  const tecnico = atual.profissao === "manutencao" || maisTempo === PROFISSOES.manutencao;
  const escolaridade = tecnico ? "tecnico" : pesado<string>([["superior_incompleto", 2], ["superior_completo", 6], ["pos_graduacao", 3], ["mestrado", 1]]);
  const origemCurso = chance(0.7) ? maisTempo : PROFISSOES[um(Object.keys(meses))]!;
  const anoInicio = Math.floor(periodos[0]!.inicio / 12);
  const formacao: { curso: string; instituicao: string; nivel: string; conclusao: number | null }[] = [
    {
      curso: tecnico || chance(0.9) ? um(origemCurso.cursos) : um(CURSOS_GERAIS),
      instituicao: tecnico ? um(["Senai", "Etec", "IFES"]) : um(INSTITUICOES),
      nivel: escolaridade === "tecnico" || escolaridade === "superior_incompleto" ? escolaridade : "superior_completo",
      conclusao: escolaridade === "superior_incompleto" ? null : anoInicio - entre(0, 1),
    },
  ];
  if (escolaridade === "pos_graduacao") formacao.push({ curso: `${um(["MBA em", "Especialização em"])} ${um(POS)}`, instituicao: um(INSTITUICOES), nivel: "pos_graduacao", conclusao: entre(anoInicio + 1, 2026) });
  if (escolaridade === "mestrado") formacao.push({ curso: `Mestrado em ${um(origemCurso.cursos)}`, instituicao: um(INSTITUICOES), nivel: "mestrado", conclusao: entre(anoInicio + 1, 2026) });

  const certificacoes = [...new Set(Object.keys(meses).flatMap((p) => (PROFISSOES[p]!.certificacoes.length && chance(0.4) ? [um(PROFISSOES[p]!.certificacoes)] : [])))];
  const idiomas = [{ idioma: "Português", nivel: "nativo" }];
  if (chance(0.75)) idiomas.push({ idioma: "Inglês", nivel: um(["basico", "intermediario", "avancado", "fluente"]) });
  if (chance(0.2)) idiomas.push({ idioma: "Espanhol", nivel: um(["basico", "intermediario", "avancado"]) });

  const [cidade, uf] = um(CIDADES);
  const primeiro = um(NOMES);
  const sobrenome = um(SOBRENOMES);
  const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const presencial = atual.profissao === "manutencao" || atual.profissao === "enfermagem";
  const pretensao = Math.round((PRETENSAO_BASE[atual.nivel]! * entre(70, 140)) / 100 / 10000) * 10000;

  return {
    candidato: {
      id,
      nome: `${primeiro} ${um(SOBRENOMES)} ${sobrenome}`,
      email: `${semAcento(primeiro)}.${semAcento(sobrenome)}.${id}@example.com`,
      telefone: `(11) 90000-${String(i + 1).padStart(4, "0")}`,
      cidade,
      uf,
      titulo: tituloAtual,
      area: profAtual.area,
      senioridade: atual.nivel,
      anos_experiencia: anos,
      resumo,
      habilidades,
      experiencias: experiencias.reverse().map(({ profissao, nivel, ...e }) => e), // mais recente primeiro, como no currículo
      formacao,
      certificacoes,
      idiomas,
      preferencias: {
        modelos: presencial ? ["presencial"] : alguns(["remoto", "hibrido", "presencial"], entre(1, 3)),
        regime: um(["clt", "clt", "pj", "indiferente"]),
        disponibilidade: um(["imediata", "15_dias", "30_dias", "60_dias"]),
        pretensao_salarial_centavos: pretensao,
      },
    },
    gabarito: { tipo, atual: atual.profissao, meses },
  };
}

const gerados = Array.from({ length: N }, (_, i) => candidato(i));
const dir = import.meta.dir;
await Bun.write(`${dir}/candidatos.json`, JSON.stringify({ candidatos: gerados.map((g) => g.candidato) }, null, 2) + "\n");
await Bun.write(
  `${dir}/gabarito.json`,
  JSON.stringify(
    {
      semente: SEMENTE,
      verdade:
        "Parecença verdadeira entre A e B = soma, para cada par de profissões, de (fração da carreira de A na primeira) × (fração da carreira de B na segunda) × (1 se é a mesma profissão, 0,5 se é vizinha, 0 se não). Vai de 0 (nada a ver) a 1 (mesma profissão a carreira toda).",
      vizinhas: VIZINHAS,
      candidatos: Object.fromEntries(gerados.map((g) => [g.candidato.id, g.gabarito])),
    },
    null,
    2,
  ) + "\n",
);

const conta = (f: (g: (typeof gerados)[number]) => string) => {
  const c: Record<string, number> = {};
  for (const g of gerados) c[f(g)] = (c[f(g)] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${legivel(k)} ${v}`).join(", ");
};
console.log(`${N} currículos (semente ${SEMENTE})`);
console.log(`carreira: ${conta((g) => g.gabarito.tipo)}`);
console.log(`experiências: ${conta((g) => `${g.candidato.experiencias.length} exp.`)}`);
console.log(`profissão atual: ${conta((g) => g.gabarito.atual)}`);
