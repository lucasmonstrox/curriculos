import { type Section, SECTIONS } from "../domain/sections";
import { deviation, mean, sum } from "../utils/stats";
import { cosine, type UnitVector } from "../utils/vector";
import type { Candidate, JobVector } from "./candidates";

/*
 * Os jeitos de medir semelhança entre dois currículos. Todos ficam aqui para o benchmark comparar;
 * o padrão é o que ganhou (DEFAULT_METHOD_ID). Os números estão no README.
 */

export type Ranked = { index: number; score: number };

type MethodDefinition = {
  label: string;
  /**
   * Nota mínima para recomendar, calibrada no benchmark para este método com o text-embedding-3-large:
   * a média do corte "média menos 2 desvios" nos sorteios (bun run lab:benchmark). Cada método tem a
   * sua porque a escala da nota muda de um para outro. null nos métodos que só ordenam (RRF e
   * z-score): a nota deles não diz o quanto os currículos se parecem, então não dá para cortar.
   * Trocar o modelo de embedding pede calibrar de novo.
   */
  minScore: number | null;
  /** Todos os outros currículos do `pool`, do mais para o menos parecido com o da posição `query`. */
  rank(query: number, pool: readonly Candidate[]): Ranked[];
};

/** Peso de cada seção na nota. A formação pesa menos: diz pouco de quem a pessoa é hoje. */
export const SECTION_WEIGHTS: Record<Section, number> = { profile: 0.3, skills: 0.3, experience: 0.3, education: 0.1 };

// k do RRF: o valor do artigo original (Cormack, Clarke e Büttcher, 2009).
const RRF_K = 60;

// Meia-vida da recência: um emprego que acabou há 5 anos vale metade de um igual que é o atual.
const HALF_LIFE_YEARS = 5;

type PairScore = (a: Candidate, b: Candidate) => number;
type JobWeight = (job: JobVector) => number;

const byScore = (a: Ranked, b: Ranked) => b.score - a.score;
const othersOf = (query: number, pool: readonly Candidate[]) => pool.map((_, i) => i).filter((i) => i !== query);

/** Método de nota por par: compara o currículo com cada um dos outros e ordena pela nota. */
function pairwise(label: string, minScore: number, score: PairScore): MethodDefinition {
  return {
    label,
    minScore,
    rank: (query, pool) =>
      othersOf(query, pool)
        .map((index) => ({ index, score: score(pool[query]!, pool[index]!) }))
        .sort(byScore),
  };
}

/** Cosseno de uma seção; 0 quando um dos dois currículos não tem a seção (ela não conta a favor). */
const sectionCosine =
  (section: Section): PairScore =>
  (a, b) => {
    const [x, y]: (UnitVector | null)[] = [a.sections[section], b.sections[section]];
    return x && y ? cosine(x, y) : 0;
  };

/**
 * Soma ponderada das seções. A experiência pode ser comparada de outro jeito (por emprego, abaixo);
 * por padrão é o cosseno da seção inteira.
 */
const weightedSections =
  (experience: PairScore = sectionCosine("experience")): PairScore =>
  (a, b) =>
    sum(SECTIONS.map((s) => SECTION_WEIGHTS[s] * (s === "experience" ? experience(a, b) : sectionCosine(s)(a, b))));

/**
 * Cada emprego de A procura o emprego mais parecido de B (MaxSim, a mesma ideia do ColBERT), e a
 * média dessas melhores notas é ponderada pelo peso de cada emprego de A.
 */
function maxSim(a: Candidate, b: Candidate, weight: JobWeight): number {
  const weights = a.jobs.map(weight);
  const best = a.jobs.map((job) => Math.max(...b.jobs.map((other) => cosine(job.vector, other.vector))));
  return sum(best.map((score, k) => score * weights[k]!)) / sum(weights);
}

/**
 * Média dos dois sentidos. Num sentido só, o currículo curto ganha de graça: os poucos empregos dele
 * sempre acham par num currículo longo.
 */
const jobsSimilarity =
  (weight: JobWeight): PairScore =>
  (a, b) =>
    (maxSim(a, b, weight) + maxSim(b, a, weight)) / 2;

/**
 * Fusão por seção: cada seção ordena os outros currículos sozinha, `transform` transforma as notas
 * da seção (em posição para o RRF, em desvios para o z-score) e o resultado se soma com os pesos.
 */
function sectionFusion(label: string, transform: (scores: readonly number[]) => number[]): MethodDefinition {
  return {
    label,
    minScore: null,
    rank(query, pool) {
      const others = othersOf(query, pool);
      const totals = others.map(() => 0);
      for (const section of SECTIONS) {
        const scores = others.map((index) => sectionCosine(section)(pool[query]!, pool[index]!));
        transform(scores).forEach((value, k) => (totals[k]! += SECTION_WEIGHTS[section] * value));
      }
      return others.map((index, k) => ({ index, score: totals[k]! })).sort(byScore);
    },
  };
}

/** RRF: vale a posição, não a nota. 1/(k + 1) para o primeiro, 1/(k + 2) para o segundo... */
function reciprocalRanks(scores: readonly number[]): number[] {
  const order = scores.map((_, k) => k).sort((x, y) => scores[y]! - scores[x]!);
  const ranks = scores.map(() => 0);
  order.forEach((k, position) => (ranks[k] = 1 / (RRF_K + position + 1)));
  return ranks;
}

/** Z-score: quanto cada nota fica acima da média das outras, em desvios padrão. */
function zScores(scores: readonly number[]): number[] {
  const average = mean(scores);
  const spread = deviation(scores);
  return scores.map((score) => (spread === 0 ? 0 : (score - average) / spread));
}

const byDuration: JobWeight = (job) => job.years;
const byDurationAndRecency: JobWeight = (job) => job.years * 0.5 ** (job.yearsSinceEnd / HALF_LIFE_YEARS);

// As notas mínimas vêm do `bun run lab:benchmark` (coluna "corte médio"), com 6 sorteios de 40.
const METHODS = {
  whole: pairwise("Ficha inteira, 1 vetor", 0.868, (a, b) => cosine(a.whole, b.whole)),
  sections: pairwise("1 vetor por seção, média ponderada", 0.763, weightedSections()),
  "sections-rrf": sectionFusion("1 vetor por seção, RRF", reciprocalRanks),
  "sections-zscore": sectionFusion("1 vetor por seção, nota normalizada (z-score)", zScores),
  "jobs-uniform": pairwise(
    "Seções + 1 vetor por emprego, pesos iguais",
    0.733,
    weightedSections(jobsSimilarity(() => 1)),
  ),
  "jobs-duration": pairwise(
    "Seções + 1 vetor por emprego, peso pela duração",
    0.734,
    weightedSections(jobsSimilarity(byDuration)),
  ),
  "jobs-recency": pairwise(
    "Seções + 1 vetor por emprego, peso pela duração e recência",
    0.735,
    weightedSections(jobsSimilarity(byDurationAndRecency)),
  ),
} satisfies Record<string, MethodDefinition>;

export type MethodId = keyof typeof METHODS;
export type Method = MethodDefinition & { id: MethodId };

/** Os ids na ordem acima; a tupla serve direto ao `z.enum` das rotas e da linha de comando. */
export const METHOD_IDS = Object.keys(METHODS) as [MethodId, ...MethodId[]];

/** O melhor na média dos sorteios do benchmark (README). */
export const DEFAULT_METHOD_ID: MethodId = "jobs-duration";

const isMethodId = (id: string): id is MethodId => id in METHODS;

export function methodById(id: string): Method {
  if (!isMethodId(id)) throw new Error(`Método desconhecido: "${id}". Opções: ${METHOD_IDS.join(", ")}.`);
  return { id, ...METHODS[id] };
}

export const allMethods = (): Method[] => METHOD_IDS.map(methodById);
