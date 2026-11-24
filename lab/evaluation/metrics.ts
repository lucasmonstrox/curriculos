import type { Recommendations } from "@/similarity/recommend";
import { mean } from "@/utils/stats";
import { type Closeness, closenessOf, PARTIAL_FROM, SIMILAR_FROM } from "./truth";

/*
 * Métricas de uma rodada de recomendação contra o gabarito.
 *
 * Só entram na conta de ordem os currículos que têm alguém ao menos "em parte" parecido: para quem
 * não tem ninguém, não existe ordem certa, e o que importa é o corte calar.
 */

export type Evaluation = {
  /** Qualidade da ordem do top (NDCG): 1 = a melhor ordem possível com os currículos que existem. */
  ndcg: number;
  /** O mesmo, só nas carreiras com mais de uma profissão, onde o vetor único mais erra. */
  ndcgMixed: number;
  /** Fração em que o 1º recomendado está entre os `top` mais parecidos de verdade. */
  firstIsRight: number;
  /** Quantas recomendações mostradas (depois do corte) caíram em cada faixa de semelhança verdadeira. */
  shown: Record<Closeness, number>;
  /** Currículos sem ninguém parecido, quantos deles o corte calou, e quantos com par ele calou por engano. */
  isolated: number;
  isolatedSilenced: number;
  wronglySilenced: number;
};

/** Ganho descontado pela posição: o 1º vale inteiro, os seguintes valem menos (log2 da posição + 1). */
const discountedGain = (gains: readonly number[]): number =>
  gains.reduce((total, gain, k) => total + gain / Math.log2(k + 2), 0);

/** Semelhanças verdadeiras de cada currículo com os outros, da maior para a menor. */
export const sortedTruth = (truth: readonly number[][]): number[][] =>
  truth.map((row, i) => row.filter((_, j) => j !== i).sort((a, b) => b - a));

export function evaluate(
  result: Recommendations,
  truth: readonly number[][],
  mixed: readonly boolean[],
  top: number,
): Evaluation {
  const ideal = sortedTruth(truth);
  const queries = truth.map((_, i) => i);
  const withMatch = queries.filter((i) => ideal[i]![0]! >= PARTIAL_FROM);
  const silenced = new Set(queries.filter((i) => result.shown[i]!.length === 0));

  const ndcgOf = (i: number) =>
    discountedGain(result.rankings[i]!.slice(0, top).map((r) => truth[i]![r.index]!)) /
    discountedGain(ideal[i]!.slice(0, top));
  // Margem de 1e-9 para empate em ponto flutuante com o `top`-ésimo melhor.
  const firstIsRight = (i: number) => truth[i]![result.rankings[i]![0]!.index]! >= ideal[i]![top - 1]! - 1e-9;

  const shown: Record<Closeness, number> = { similar: 0, partial: 0, unrelated: 0 };
  result.shown.forEach((list, i) => list.forEach((r) => shown[closenessOf(truth[i]![r.index]!)]++));

  return {
    ndcg: mean(withMatch.map(ndcgOf)),
    ndcgMixed: mean(withMatch.filter((i) => mixed[i]).map(ndcgOf)),
    firstIsRight: withMatch.filter(firstIsRight).length / withMatch.length,
    shown,
    isolated: queries.length - withMatch.length,
    isolatedSilenced: queries.filter((i) => !withMatch.includes(i) && silenced.has(i)).length,
    wronglySilenced: withMatch.filter((i) => silenced.has(i)).length,
  };
}

/** Alguém bem mais parecido de verdade que ficou de fora do que foi mostrado. */
export type Miss = { query: number; missing: number; truth: number; position: number; worstShown: number };

// "Bem mais parecido" = pelo menos 0,1 acima do pior mostrado na semelhança verdadeira.
const MISS_MARGIN = 0.1;

/**
 * Casos para ler à mão. Quando o corte deixou menos que `top`, conta como falta todo "parecido" que
 * não apareceu; senão, quem passa o pior mostrado por MISS_MARGIN.
 */
export function findMisses(result: Recommendations, truth: readonly number[][], top: number): Miss[] {
  const ideal = sortedTruth(truth);
  return result.shown.flatMap((shown, query) => {
    if (ideal[query]![0]! < PARTIAL_FROM) return [];
    const worstShown = shown.length ? Math.min(...shown.map((r) => truth[query]![r.index]!)) : 0;
    const threshold = shown.length < top ? SIMILAR_FROM : worstShown + MISS_MARGIN;
    const shownIds = new Set(shown.map((r) => r.index));
    return result.rankings[query]!.flatMap((r, k) =>
      !shownIds.has(r.index) && truth[query]![r.index]! >= threshold
        ? [{ query, missing: r.index, truth: truth[query]![r.index]!, position: k + 1, worstShown }]
        : [],
    );
  });
}
