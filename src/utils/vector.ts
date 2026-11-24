/**
 * Vetor de norma 1. O tipo marca que o vetor já foi normalizado: entre dois deles, o cosseno é só o
 * produto interno, sem dividir pelas normas a cada comparação.
 */
export type UnitVector = readonly number[] & { readonly __unit: true };

export function normalize(vector: readonly number[]): UnitVector {
  const norm = Math.sqrt(vector.reduce((total, x) => total + x * x, 0));
  if (norm === 0) throw new Error("Vetor nulo não tem direção e não pode ser normalizado.");
  return vector.map((x) => x / norm) as unknown as UnitVector;
}

/** Cosseno entre dois vetores unitários: 1 é a mesma direção, 0 é nada em comum. */
export function cosine(a: UnitVector, b: UnitVector): number {
  if (a.length !== b.length) throw new Error(`Dimensões diferentes: ${a.length} e ${b.length}.`);
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i]! * b[i]!;
  return total;
}
