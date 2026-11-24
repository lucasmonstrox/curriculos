import type { Sector } from "@/domain/resume";

/*
 * Setores onde os empregos sintéticos acontecem. O setor é sorteado à parte da profissão: duas
 * profissões diferentes podem dividir setor e até empresa, o que confunde de propósito quem compara
 * currículos só pelas palavras.
 */

export type SectorCatalog = {
  /** O que a empresa vende ou opera; entra nas atividades ("as APIs de {product}"). */
  products: readonly string[];
  companies: readonly string[];
};

export const SECTOR_CATALOG = {
  finance: {
    products: ["pagamentos", "cartão de crédito", "empréstimo"],
    companies: ["Banco Aurora", "PagaLeve", "Conta Fácil", "Crédito Já"],
  },
  retail: {
    products: ["e-commerce", "estoque", "lojas físicas"],
    companies: ["LojaMix", "Mercado Bom", "Atacarejo Central", "Moda Rio"],
  },
  health: {
    products: ["agendamento de consultas", "prontuário", "convênios"],
    companies: ["Hospital Bem Viver", "Clínica Vida Plena", "Rede Saúde Mais"],
  },
  education: {
    products: ["plataforma de cursos", "matrícula", "provas online"],
    companies: ["Aprende+", "Escola Horizonte", "Faculdade Nova Era"],
  },
  telecom: {
    products: ["planos de celular", "internet residencial", "faturamento"],
    companies: ["TelcoSul", "ConectaNet"],
  },
  industry: {
    products: ["linha de produção", "manutenção de fábrica", "compras de insumos"],
    companies: ["Aço Capixaba", "Celulose Litoral", "Metalúrgica Paraná"],
  },
  insurance: {
    products: ["seguro auto", "sinistros", "cotação"],
    companies: ["Seguros Horizonte", "Protege Seguros"],
  },
  software: {
    products: ["ERP em nuvem", "sistema de gestão", "app de delivery"],
    companies: ["NuvemERP", "GestãoFácil Software", "Entrega Rápida"],
  },
  logistics: {
    products: ["entregas", "frota", "rastreamento de cargas"],
    companies: ["TransLog", "Rota Certa"],
  },
} as const satisfies Partial<Record<Sector, SectorCatalog>>;

export type CatalogSector = keyof typeof SECTOR_CATALOG;

export const CATALOG_SECTORS = Object.keys(SECTOR_CATALOG) as CatalogSector[];
