import { deviation, mean } from "../utils/stats";
import type { Candidate } from "./candidates";
import type { Method, Ranked } from "./methods";

/** Quantos recomendar quando ninguém diz: o padrão da API e da linha de comando. */
export const DEFAULT_TOP = 3;

/*
 * Corte relativo, usado pelo laboratório para calibrar a nota mínima de cada método: a média menos 2
 * desvios da nota do mais parecido de cada currículo. Sai dos próprios dados porque a escala da nota
 * muda de um modelo de embedding para outro. O produto usa o valor já calibrado (Method.minScore).
 */
const CUTOFF_DEVIATIONS = 2;

/** Nota mínima: um valor fixo, "relative" (calcula dos dados, ver acima) ou null (sem corte). */
export type Cutoff = number | "relative" | null;

export type Recommendations = {
  /** Para cada currículo, todos os outros do mais para o menos parecido. */
  rankings: Ranked[][];
  /** A nota mínima aplicada; null quando não houve corte. */
  cutoff: number | null;
  /** O que se mostra para cada currículo: até `top`, acima do corte. Pode ficar vazio. */
  shown: Ranked[][];
};

/**
 * Recomenda entre os currículos de um conjunto. Por padrão corta pela nota mínima calibrada do método;
 * métodos que só ordenam (minScore null) nunca cortam, qualquer que seja o `cutoff` pedido.
 */
export function recommend(
  method: Method,
  pool: readonly Candidate[],
  top: number,
  cutoff: Cutoff = method.minScore,
): Recommendations {
  const rankings = pool.map((_, query) => method.rank(query, pool));
  const best = rankings.map((ranking) => ranking[0]!.score);
  const minScore =
    method.minScore === null || cutoff === null
      ? null
      : cutoff === "relative"
        ? mean(best) - CUTOFF_DEVIATIONS * deviation(best)
        : cutoff;
  return {
    rankings,
    cutoff: minScore,
    shown: rankings.map((ranking) => ranking.slice(0, top).filter((r) => minScore === null || r.score >= minScore)),
  };
}
