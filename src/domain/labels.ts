import type { Area, EducationLevel, LanguageLevel, Resume, Sector, Seniority } from "./resume";

type Preferences = Resume["preferences"];

/*
 * Rótulos em português dos valores fixos do currículo. É o texto que vai para o embedding e para as
 * páginas de exemplo; o código guarda só o valor em inglês.
 */

export const AREA_LABELS: Record<Area, string> = {
  technology: "tecnologia",
  data: "dados",
  design: "design",
  product: "produto",
  sales: "comercial",
  marketing: "marketing",
  finance: "finanças",
  people: "pessoas",
  health: "saúde",
  industry: "indústria",
  operations: "operações",
  other: "outra",
};

export const SECTOR_LABELS: Record<Sector, string> = {
  finance: "financeiro",
  retail: "varejo",
  health: "saúde",
  education: "educação",
  telecom: "telecomunicações",
  industry: "indústria",
  insurance: "seguros",
  software: "software",
  logistics: "logística",
  public: "setor público",
  services: "serviços",
  other: "outro",
};

export const SENIORITY_LABELS: Record<Seniority, string> = {
  intern: "Estágio",
  junior: "Júnior",
  mid: "Pleno",
  senior: "Sênior",
  specialist: "Especialista",
  lead: "Liderança",
};

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  "high-school": "ensino médio",
  technical: "técnico",
  "incomplete-bachelor": "superior incompleto",
  bachelor: "superior completo",
  postgraduate: "pós-graduação",
  master: "mestrado",
  doctorate: "doutorado",
};

export const LANGUAGE_LEVEL_LABELS: Record<LanguageLevel, string> = {
  basic: "básico",
  intermediate: "intermediário",
  advanced: "avançado",
  fluent: "fluente",
  native: "nativo",
};

export const WORK_MODEL_LABELS: Record<Preferences["workModels"][number], string> = {
  remote: "remoto",
  hybrid: "híbrido",
  onsite: "presencial",
};

export const CONTRACT_LABELS: Record<NonNullable<Preferences["contract"]>, string> = {
  clt: "CLT",
  pj: "PJ",
  any: "CLT ou PJ",
};

export const AVAILABILITY_LABELS: Record<NonNullable<Preferences["availability"]>, string> = {
  immediate: "imediata",
  "15-days": "em 15 dias",
  "30-days": "em 30 dias",
  "60-days": "em 60 dias",
};
