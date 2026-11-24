/**
 * Sorteio com semente (mulberry32). A mesma semente gera sempre a mesma sequência, então o mesmo
 * conjunto de currículos: dá para comparar métodos e mudanças em cima dos mesmos dados.
 */
export type Random = {
  /** Número em [0, 1). */
  next(): number;
  chance(probability: number): boolean;
  /** Inteiro entre `min` e `max`, os dois inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  /** `count` itens diferentes, em ordem sorteada (todos, se a lista for menor). */
  sample<T>(items: readonly T[], count: number): T[];
  /** Um valor, com chance proporcional ao peso. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
};

export function createRandom(seed: number): Random {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));

  function pick<T>(items: readonly T[]): T {
    if (!items.length) throw new Error("Sorteio numa lista vazia.");
    return items[Math.floor(next() * items.length)]!;
  }

  // Fisher–Yates: cada ordem tem a mesma chance.
  function shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  }

  function weighted<T>(entries: readonly (readonly [T, number])[]): T {
    let remaining = next() * entries.reduce((total, [, weight]) => total + weight, 0);
    for (const [value, weight] of entries) {
      remaining -= weight;
      if (remaining < 0) return value;
    }
    return pick(entries)[0];
  }

  return {
    next,
    chance: (probability) => next() < probability,
    int,
    pick,
    shuffle,
    sample: (items, count) => shuffle(items).slice(0, count),
    weighted,
  };
}
