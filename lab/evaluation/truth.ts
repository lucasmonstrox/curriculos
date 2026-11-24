import type { LabDataset, Truth } from "../dataset";
import { sum } from "@/utils/stats";

/*
 * A semelhança verdadeira entre dois currículos sintéticos, pelo gabarito.
 *
 * Parecença de A com B = soma, para cada par de profissões (p de A, q de B), de
 *   fração da carreira de A em p × fração da carreira de B em q × crédito(p, q),
 * com crédito 1 para a mesma profissão, 0,5 para vizinhas e 0 para o resto. Vai de 0 (nada a ver)
 * a 1 (mesma profissão a carreira toda). O 0,5 das vizinhas é uma régua nossa, não um fato.
 */

const NEIGHBOR_CREDIT = 0.5;

/** A partir de quanto a semelhança verdadeira conta como "parecido" e como "em parte". */
export const SIMILAR_FROM = 0.5;
export const PARTIAL_FROM = 0.2;

export type Closeness = "similar" | "partial" | "unrelated";

export const CLOSENESS_LABELS: Record<Closeness, string> = {
  similar: "parecido",
  partial: "em parte",
  unrelated: "nada a ver",
};

export const closenessOf = (truth: number): Closeness =>
  truth >= SIMILAR_FROM ? "similar" : truth >= PARTIAL_FROM ? "partial" : "unrelated";

/** Fração da carreira em cada profissão, da maior para a menor. */
export function careerShares(truth: Truth, id: string): [profession: string, share: number][] {
  const career = truth.careers[id];
  if (!career) throw new Error(`Currículo ${id} sem carreira no gabarito.`);
  const total = sum(Object.values(career.months));
  return Object.entries(career.months)
    .map(([profession, months]): [string, number] => [profession, months / total])
    .sort((a, b) => b[1] - a[1]);
}

/** Tudo o que a avaliação e as páginas precisam do gabarito, na ordem dos currículos do conjunto. */
export type GroundTruth = {
  /** Semelhança verdadeira entre cada par de currículos. */
  matrix: number[][];
  /** Se a carreira passou por mais de uma profissão. */
  mixed: boolean[];
  /** A carreira por extenso: "executivo de vendas 55% + desenvolvedor backend 45%". */
  careers: string[];
  /** A profissão de hoje (o emprego mais recente), por extenso. */
  currents: string[];
};

export function groundTruth({ resumes, truth }: LabDataset): GroundTruth {
  const ids = resumes.map((resume) => resume.id);
  const shares = ids.map((id) => careerShares(truth, id));
  const nameOf = (profession: string) => truth.professions[profession] ?? profession;
  return {
    matrix: truthMatrix(truth, ids),
    mixed: shares.map((career) => career.length > 1),
    careers: shares.map((career) =>
      career.map(([profession, share]) => `${nameOf(profession)} ${Math.round(share * 100)}%`).join(" + "),
    ),
    currents: ids.map((id) => nameOf(truth.careers[id]!.current)),
  };
}

/** Matriz de semelhança verdadeira entre todos os pares, na ordem de `ids`. */
export function truthMatrix(truth: Truth, ids: readonly string[]): number[][] {
  const neighbors = new Set(truth.neighbors.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
  const credit = (p: string, q: string) => (p === q ? 1 : neighbors.has(`${p}|${q}`) ? NEIGHBOR_CREDIT : 0);
  const shares = ids.map((id) => careerShares(truth, id));
  return shares.map((a) => shares.map((b) => sum(a.flatMap(([p, fa]) => b.map(([q, fb]) => fa * fb * credit(p, q))))));
}
