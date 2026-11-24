import { describe, expect, test } from "bun:test";
import { experienceMonths } from "@/domain/timeline";
import type { Recommendations } from "@/similarity/recommend";
import { parseMonth } from "@/utils/month";
import { evaluate } from "./evaluation/metrics";
import { truthMatrix } from "./evaluation/truth";
import { generateDataset } from "./generator";
import { createRandom } from "./generator/random";
import { formatCents } from "./utils/money";

describe("sorteio com semente", () => {
  test("a mesma semente dá a mesma sequência", () => {
    const [a, b] = [createRandom(42), createRandom(42)];
    expect(Array.from({ length: 5 }, a.next)).toEqual(Array.from({ length: 5 }, b.next));
  });
  test("peso zero nunca sai", () => {
    const rng = createRandom(1);
    for (let i = 0; i < 200; i++)
      expect(
        rng.weighted([
          ["sim", 1],
          ["nunca", 0],
        ] as const),
      ).toBe("sim");
  });
});

describe("gerador", () => {
  const dataset = generateDataset({ seed: 3, size: 25 });

  test("é reproduzível: a mesma semente gera o mesmo conjunto", () =>
    expect(generateDataset({ seed: 3, size: 25 })).toEqual(dataset));

  test("currículos têm de 2 a 7 empregos, do mais recente para o mais antigo", () => {
    for (const resume of dataset.resumes) {
      expect(resume.experiences.length).toBeGreaterThanOrEqual(2);
      expect(resume.experiences.length).toBeLessThanOrEqual(7);
      const starts = resume.experiences.map((e) => e.start);
      expect(starts).toEqual(starts.toSorted().toReversed());
    }
  });

  test("o gabarito soma os mesmos meses que a conta de duração dos empregos", () => {
    const reference = parseMonth(dataset.referenceMonth);
    for (const resume of dataset.resumes) {
      const fromJobs = resume.experiences.reduce((total, e) => total + experienceMonths(e, reference), 0);
      const fromTruth = Object.values(dataset.truth.careers[resume.id]!.months).reduce((a, b) => a + b, 0);
      expect(fromTruth).toBe(fromJobs);
    }
  });
});

describe("gabarito e métricas", () => {
  const truth = {
    professions: { a: "a", b: "b", c: "c" },
    neighbors: [["a", "b"]] as [string, string][],
    careers: {
      x: { current: "a", months: { a: 12 } },
      y: { current: "a", months: { a: 6, c: 6 } },
      z: { current: "b", months: { b: 12 } },
    },
  };

  test("mesma profissão vale 1, vizinha 0,5, e carreira mista divide pela fração do tempo", () => {
    const matrix = truthMatrix(truth, ["x", "y", "z"]);
    expect(matrix[0]![0]).toBe(1);
    expect(matrix[0]![2]).toBe(0.5);
    expect(matrix[0]![1]).toBe(0.5);
  });

  test("ordem perfeita tem NDCG 1", () => {
    const matrix = truthMatrix(truth, ["x", "y", "z"]);
    const rankings = matrix.map((row, i) =>
      row
        .map((score, index) => ({ index, score }))
        .filter((r) => r.index !== i)
        .sort((a, b) => b.score - a.score),
    );
    const result: Recommendations = { rankings, cutoff: null, shown: rankings.map((r) => r.slice(0, 1)) };
    expect(evaluate(result, matrix, [false, true, false], 1).ndcg).toBeCloseTo(1);
  });
});

test("dinheiro em centavos vira reais", () => expect(formatCents(900_000).replace(/\s/g, " ")).toBe("R$ 9.000,00"));
