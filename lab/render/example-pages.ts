import {
  AREA_LABELS,
  AVAILABILITY_LABELS,
  CONTRACT_LABELS,
  EDUCATION_LABELS,
  LANGUAGE_LEVEL_LABELS,
  SECTOR_LABELS,
  SENIORITY_LABELS,
  WORK_MODEL_LABELS,
} from "@/domain/labels";
import type { Resume } from "@/domain/resume";
import { careerSummary, describeDuration } from "@/domain/summary";
import { experienceMonths } from "@/domain/timeline";
import type { Profile } from "@/profile/profile";
import type { Method } from "@/similarity/methods";
import type { Recommendations } from "@/similarity/recommend";
import { formatCents } from "../utils/money";
import { parseMonth } from "@/utils/month";
import { slugify } from "@/utils/text";
import type { LabDataset } from "../dataset";
import type { Miss } from "../evaluation/metrics";
import { CLOSENESS_LABELS, closenessOf, type GroundTruth } from "../evaluation/truth";

/*
 * As páginas de docs/exemplos, separadas por profissão de hoje:
 *
 *   docs/exemplos/README.md                      índice geral, agrupado por profissão
 *   docs/exemplos/<profissão>/README.md          os currículos daquela profissão
 *   docs/exemplos/<profissão>/<id>.md            um currículo
 *
 * Cada página de currículo mostra o currículo padronizado, a carreira pelo gabarito, as
 * recomendações com a nota e a semelhança verdadeira, o que ficou de fora e a ficha exata que virou
 * vetor. É para ler e julgar à mão se a recomendação faz sentido.
 */

export type ExamplePagesInput = {
  dataset: LabDataset;
  profiles: readonly Profile[];
  result: Recommendations;
  truth: GroundTruth;
  method: Method;
  misses: readonly Miss[];
  /** Modelo de embedding, para dizer na página com o que foi medido. */
  embeddingModel: string;
};

/** O caminho de cada página (relativo a docs/exemplos) e o conteúdo dela. */
export function renderExamplePages(input: ExamplePagesInput): Map<string, string> {
  const pages = new Map<string, string>();
  input.dataset.resumes.forEach((resume, index) =>
    pages.set(pagePath(input, index), renderResumePage(input, resume, index)),
  );
  for (const [folder, indexes] of groupByProfession(input))
    pages.set(`${folder}/README.md`, renderProfessionIndex(input, indexes));
  pages.set("README.md", renderIndex(input));
  return pages;
}

/** Pasta de um currículo: a profissão de hoje em forma de identificador ("desenvolvedor-backend"). */
export const professionFolder = (truth: GroundTruth, index: number): string => slugify(truth.currents[index]!);

export const pagePath = ({ dataset, truth }: Pick<ExamplePagesInput, "dataset" | "truth">, index: number): string =>
  `${professionFolder(truth, index)}/${dataset.resumes[index]!.id}.md`;

/** Pastas de profissão com os currículos de cada uma, da profissão com mais currículos para a de menos. */
function groupByProfession({ dataset, truth }: ExamplePagesInput): [string, number[]][] {
  const groups = new Map<string, number[]>();
  dataset.resumes.forEach((_, index) => {
    const folder = professionFolder(truth, index);
    groups.set(folder, [...(groups.get(folder) ?? []), index]);
  });
  return [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

const formatScore = (score: number) => score.toFixed(3);
const formatTruth = (truth: number) => `${truth.toFixed(2)} (${CLOSENESS_LABELS[closenessOf(truth)]})`;

/** Link de uma página de currículo para outra: mesma pasta usa só o arquivo; outra pasta sobe um nível. */
function resumeLink(input: ExamplePagesInput, from: number, to: number): string {
  const id = input.dataset.resumes[to]!.id;
  const sameFolder = professionFolder(input.truth, from) === professionFolder(input.truth, to);
  return `[${id}](${sameFolder ? `${id}.md` : `../${pagePath(input, to)}`})`;
}

function renderResumePage(input: ExamplePagesInput, resume: Resume, index: number): string {
  const { dataset, profiles, result, truth, method } = input;
  const reference = parseMonth(dataset.referenceMonth);
  const shown = result.shown[index]!;
  const misses = input.misses.filter((miss) => miss.query === index);
  const resumes = dataset.resumes;

  return [
    `# ${resume.id} · ${resume.headline}`,
    "",
    `> Currículo fictício do laboratório (semente ${dataset.seed}). [Outros de ${truth.currents[index]}](README.md) · [Índice geral](../README.md)`,
    "",
    "## Carreira, pelo gabarito",
    "",
    `${truth.careers[index]} · ${resume.experiences.length} empregos · ${truth.mixed[index] ? "carreira mista" : "uma profissão"}`,
    "",
    "## Recomendados",
    "",
    `Método: ${method.label}. Nota mínima para aparecer: ${result.cutoff === null ? "sem corte" : formatScore(result.cutoff)}.`,
    "",
    shown.length
      ? [
          "| # | Currículo | Hoje | Carreira | Nota | Semelhança verdadeira |",
          "|---|---|---|---|---|---|",
          ...shown.map(
            (r, k) =>
              `| ${k + 1} | ${resumeLink(input, index, r.index)} | ${resumes[r.index]!.headline} | ${truth.careers[r.index]} | ${formatScore(r.score)} | ${formatTruth(truth.matrix[index]![r.index]!)} |`,
          ),
        ].join("\n")
      : "Nenhum currículo parecido o bastante para mostrar.",
    ...(misses.length
      ? [
          "",
          "Ficou de fora alguém bem mais parecido de verdade:",
          "",
          ...misses.map(
            (miss) =>
              `- ${resumeLink(input, index, miss.missing)} (${truth.careers[miss.missing]}): semelhança verdadeira ${miss.truth.toFixed(2)}, ficou em ${miss.position}º.`,
          ),
        ]
      : []),
    "",
    "## Currículo padronizado",
    "",
    `**Resumo:** ${careerSummary(resume, reference)}`,
    "",
    `**Área:** ${AREA_LABELS[resume.area]} · **Nível:** ${SENIORITY_LABELS[resume.seniority]}`,
    "",
    `**Habilidades:** ${resume.skills.join(", ")}`,
    "",
    "### Experiência",
    "",
    ...resume.experiences.flatMap((experience) => [
      `**${experience.title}**, ${experience.company} (${SECTOR_LABELS[experience.sector]}) · ${experience.start} a ${experience.end ?? "atual"} · ${describeDuration(experienceMonths(experience, reference))} · profissão: ${experience.occupation}`,
      "",
      ...experience.activities.map((activity) => `- ${activity}`),
      "",
    ]),
    "### Formação",
    "",
    ...resume.education.map(
      (e) =>
        `- ${[e.course, e.institution].filter(Boolean).join(", ")} (${EDUCATION_LABELS[e.level]}${e.completedIn ? `, ${e.completedIn}` : ""})`,
    ),
    ...(resume.certifications.length ? ["", `**Certificações:** ${resume.certifications.join(", ")}`] : []),
    "",
    `**Idiomas:** ${resume.languages.map((l) => `${l.language} ${LANGUAGE_LEVEL_LABELS[l.level]}`).join(", ")}`,
    "",
    "### Fora do vetor",
    "",
    "Servem para filtrar ou contatar, não para medir semelhança (e dados pessoais não vão para o embedding).",
    "",
    `- **Pessoa (fictícia):** ${resume.personal.name}, ${resume.personal.city}/${resume.personal.state}, ${resume.personal.email}`,
    `- **Preferências:** ${renderPreferences(resume)}`,
    "",
    "## A ficha que vira vetor",
    "",
    `Cada seção vira um vetor e cada emprego vira outro (4 seções e ${profiles[index]!.jobs.length} empregos), com o ${input.embeddingModel}.`,
    "",
    "<details>",
    "<summary>Ver o texto exato</summary>",
    "",
    "```markdown",
    profiles[index]!.whole,
    "```",
    "",
    "</details>",
    "",
  ].join("\n");
}

function renderPreferences({ preferences }: Resume): string {
  const parts = [
    preferences.workModels.length ? preferences.workModels.map((m) => WORK_MODEL_LABELS[m]).join(" ou ") : null,
    preferences.contract ? CONTRACT_LABELS[preferences.contract] : null,
    preferences.availability ? `disponibilidade ${AVAILABILITY_LABELS[preferences.availability]}` : null,
    preferences.salaryExpectationCents
      ? `pretensão de ${formatCents(preferences.salaryExpectationCents)} por mês`
      : null,
  ];
  return parts.filter(Boolean).join(", ") || "não informadas";
}

/** Linhas da tabela de currículos; `linkTo` resolve o link conforme a página que mostra a tabela. */
function resumeRows(input: ExamplePagesInput, indexes: readonly number[], linkTo: (index: number) => string): string[] {
  const { dataset, result, truth } = input;
  return [
    "| Currículo | Hoje | Carreira | Empregos | 1º recomendado | Semelhança verdadeira do 1º |",
    "|---|---|---|---|---|---|",
    ...indexes.map((index) => {
      const resume = dataset.resumes[index]!;
      const first = result.shown[index]![0];
      const recommended = first
        ? `${linkTo(first.index)} ${dataset.resumes[first.index]!.headline}`
        : "nenhum parecido";
      return `| ${linkTo(index)} | ${resume.headline} | ${truth.careers[index]} | ${resume.experiences.length} | ${recommended} | ${first ? formatTruth(truth.matrix[index]![first.index]!) : ""} |`;
    }),
  ];
}

function renderProfessionIndex(input: ExamplePagesInput, indexes: readonly number[]): string {
  const profession = input.truth.currents[indexes[0]!]!;
  // O índice mora na mesma pasta que os currículos dela: os links saem como de uma página dessa pasta.
  const linkTo = (index: number) => resumeLink(input, indexes[0]!, index);
  return [
    `# ${profession[0]!.toUpperCase()}${profession.slice(1)}`,
    "",
    `Currículos cuja profissão de hoje é ${profession}. [Índice geral](../README.md)`,
    "",
    ...resumeRows(input, indexes, linkTo),
    "",
  ].join("\n");
}

function renderIndex(input: ExamplePagesInput): string {
  const { dataset, method, embeddingModel, truth } = input;
  const linkTo = (index: number) => `[${dataset.resumes[index]!.id}](${pagePath(input, index)})`;
  return [
    "# Exemplos de currículos e recomendações",
    "",
    `${dataset.resumes.length} currículos fictícios gerados pelo laboratório (semente ${dataset.seed}), já no formato padronizado que a extração entrega, separados pela profissão de hoje. ` +
      `Recomendação: ${method.label}, com o ${embeddingModel}. Gere de novo com \`bun run lab:examples\`.`,
    "",
    "A semelhança verdadeira vem do gabarito: quanto da carreira de um cai nas mesmas profissões (ou vizinhas) da carreira do outro, de 0 (nada a ver) a 1 (mesma carreira).",
    "",
    "O [grafo](grafo.html) mostra os mesmos currículos ligados pelas recomendações; clique numa pessoa para abrir o currículo.",
    "",
    ...groupByProfession(input).flatMap(([folder, indexes]) => [
      `## [${truth.currents[indexes[0]!]}](${folder}/README.md)`,
      "",
      ...resumeRows(input, indexes, linkTo),
      "",
    ]),
  ].join("\n");
}
