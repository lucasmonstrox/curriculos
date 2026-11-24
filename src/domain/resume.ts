import { z } from "zod";
import "../lib/zod"; // mensagens do Zod em português, para todo o projeto
import { MONTH_PATTERN } from "../utils/month";

/*
 * O currículo padronizado: o formato que o modelo de linguagem devolve depois de ler o currículo
 * original (src/extraction) e que o gerador sintético do laboratório também produz (lab/generator).
 *
 * As descrições (`.describe`) vão junto no JSON Schema que o modelo recebe, por isso estão em
 * português e dizem a regra de cada campo. Tudo é obrigatório e o que pode faltar é `null`: a
 * saída estruturada estrita da OpenAI não aceita campo opcional.
 *
 * Listas fechadas (área, setor, nível) deixam as fichas comparáveis: "TI", "Tecnologia" e "Tech"
 * viram o mesmo `technology`. Os rótulos em português de cada valor ficam em ./labels.ts.
 */

export const AREAS = [
  "technology",
  "data",
  "design",
  "product",
  "sales",
  "marketing",
  "finance",
  "people",
  "health",
  "industry",
  "operations",
  "other",
] as const;

export const SECTORS = [
  "finance",
  "retail",
  "health",
  "education",
  "telecom",
  "industry",
  "insurance",
  "software",
  "logistics",
  "public",
  "services",
  "other",
] as const;

export const SENIORITIES = ["intern", "junior", "mid", "senior", "specialist", "lead"] as const;

export const EDUCATION_LEVELS = [
  "high-school",
  "technical",
  "incomplete-bachelor",
  "bachelor",
  "postgraduate",
  "master",
  "doctorate",
] as const;

export const LANGUAGE_LEVELS = ["basic", "intermediate", "advanced", "fluent", "native"] as const;
export const WORK_MODELS = ["remote", "hybrid", "onsite"] as const;
export const CONTRACTS = ["clt", "pj", "any"] as const;
export const AVAILABILITIES = ["immediate", "15-days", "30-days", "60-days"] as const;

const text = z.string().min(1);
const month = z.string().regex(MONTH_PATTERN);

export const experienceSchema = z
  .object({
    title: text.describe(
      "Cargo com nome padronizado e o nível quando o currículo informa (ex.: Desenvolvedor Backend Sênior).",
    ),
    occupation: text.describe(
      "Profissão desse emprego em minúsculas, sem nível nem empresa (ex.: desenvolvedor backend, analista de dados). Empregos da mesma profissão usam exatamente o mesmo nome: é por ele que o código soma o tempo em cada profissão.",
    ),
    company: text.describe("Nome da empresa como está no currículo."),
    sector: z.enum(SECTORS).describe("Setor da empresa."),
    start: month.describe("Início no formato AAAA-MM. Sem o mês, use 01."),
    end: month.nullable().describe("Fim no formato AAAA-MM; null quando é o emprego atual. Sem o mês, use 12."),
    activities: z
      .array(text)
      .min(1)
      .describe("O que a pessoa fez nesse emprego: uma frase curta por item, sem inventar números."),
  })
  // Texto AAAA-MM de largura fixa: a ordem alfabética é a ordem do tempo.
  .refine((job) => job.end === null || job.end >= job.start, { message: "O fim vem antes do início." });

export const educationSchema = z.object({
  course: text.describe("Nome do curso."),
  institution: text.nullable().describe("Instituição de ensino; null quando não informa."),
  level: z.enum(EDUCATION_LEVELS),
  completedIn: z.number().int().nullable().describe("Ano de conclusão; null quando não concluiu ou não informou."),
});

export const languageSchema = z.object({
  language: text.describe("Idioma em português (ex.: Inglês)."),
  level: z.enum(LANGUAGE_LEVELS),
});

export const resumeSchema = z.object({
  id: text,
  // Dados pessoais ficam isolados neste bloco e nunca entram no texto que vira vetor (LGPD).
  personal: z
    .object({
      name: text,
      email: z.email().nullable(),
      phone: text.nullable(),
      city: text.nullable(),
      state: z.string().length(2).nullable().describe("UF com duas letras."),
    })
    .describe("Dados pessoais."),
  headline: text.describe("Cargo atual, padronizado e sem o nível (ex.: Desenvolvedor Backend)."),
  area: z.enum(AREAS).describe("Área do emprego atual."),
  seniority: z.enum(SENIORITIES).describe("Nível atual, pelo cargo e pelo tempo na profissão atual."),
  // O resumo com o tempo em cada profissão não vem do modelo: o código monta a partir das datas e do
  // `occupation` de cada emprego (src/domain/summary.ts). Do modelo vem só a frase de foco.
  focus: text.describe(
    "Uma frase sobre o foco do trabalho atual, tirada do currículo (ex.: Foco em APIs e banco de dados).",
  ),
  skills: z.array(text).describe("Habilidades com nome padronizado, sem repetição."),
  experiences: z.array(experienceSchema).min(1).describe("Empregos, do mais recente para o mais antigo."),
  education: z.array(educationSchema),
  certifications: z.array(text),
  languages: z.array(languageSchema),
  // Preferências servem para filtrar, não para medir semelhança: também ficam fora do vetor.
  preferences: z.object({
    workModels: z.array(z.enum(WORK_MODELS)).describe("Modelos de trabalho aceitos; vazio quando não informa."),
    contract: z.enum(CONTRACTS).nullable(),
    availability: z.enum(AVAILABILITIES).nullable(),
    salaryExpectationCents: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("Pretensão salarial mensal em centavos (R$ 8.000,00 = 800000)."),
  }),
});

/** O que o modelo de linguagem devolve: o currículo sem o `id`, que quem chama atribui. */
export const extractedResumeSchema = resumeSchema.omit({ id: true });

export type Resume = z.infer<typeof resumeSchema>;
export type ExtractedResume = z.infer<typeof extractedResumeSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Area = Resume["area"];
export type Sector = Experience["sector"];
export type Seniority = Resume["seniority"];
export type EducationLevel = z.infer<typeof educationSchema>["level"];
export type LanguageLevel = z.infer<typeof languageSchema>["level"];
