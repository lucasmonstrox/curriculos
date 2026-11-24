import { describe, expect, test } from "bun:test";
import { fakeEmbeddings } from "../../test/support/fakes";
import { EXAMPLES_REFERENCE_MONTH, EXTRACTION_EXAMPLES } from "../extraction/examples";
import { SECTIONS } from "../domain/sections";
import { normalize, type UnitVector } from "../utils/vector";
import { type Candidate, prepareDataset } from "./candidates";
import { allMethods, methodById } from "./methods";
import { recommend } from "./recommend";

/*
 * Candidatos montados à mão em 3 dimensões: dá para saber de antemão quem é parecido com quem.
 * A e B são iguais; C é parecido em parte; D aponta para outro lado.
 */

const unit = (...xs: number[]): UnitVector => normalize(xs);
function candidate(id: string, direction: UnitVector, jobs: UnitVector[] = [direction]): Candidate {
  return {
    id,
    whole: direction,
    sections: Object.fromEntries(SECTIONS.map((s) => [s, direction])) as Candidate["sections"],
    jobs: jobs.map((vector) => ({ vector, years: 2, yearsSinceEnd: 0 })),
  };
}
const pool = [
  candidate("A", unit(1, 0, 0)),
  candidate("B", unit(1, 0, 0)),
  candidate("C", unit(1, 1, 0)),
  candidate("D", unit(0, 0, 1)),
];

describe("todos os métodos", () => {
  test.each(allMethods().map((method) => [method.id, method] as const))(
    "%s: o idêntico vem primeiro e o oposto por último",
    (_, method) => {
      const ranking = method.rank(0, pool).map((r) => pool[r.index]!.id);
      expect(ranking[0]).toBe("B");
      expect(ranking.at(-1)).toBe("D");
      expect(ranking).not.toContain("A");
    },
  );
});

test("nota por emprego é simétrica: A parecido com B tanto quanto B com A", () => {
  const method = methodById("jobs-duration");
  const twoJobs = candidate("X", unit(1, 0, 0), [unit(1, 0, 0), unit(0, 1, 0)]);
  const oneJob = candidate("Y", unit(1, 0, 0), [unit(1, 0, 0)]);
  const xy = method.rank(0, [twoJobs, oneJob])[0]!.score;
  const yx = method.rank(0, [oneJob, twoJobs])[0]!.score;
  expect(xy).toBeCloseTo(yx);
});

describe("corte de ninguém parecido", () => {
  test("corte relativo (o do laboratório): média menos 2 desvios da nota do mais parecido de cada um", () => {
    const result = recommend(methodById("sections"), pool, 3, "relative");
    const best = result.rankings.map((ranking) => ranking[0]!.score);
    const average = best.reduce((a, b) => a + b, 0) / best.length;
    const spread = Math.sqrt(best.reduce((a, b) => a + (b - average) ** 2, 0) / best.length);
    expect(result.cutoff!).toBeCloseTo(average - 2 * spread);
    for (const shown of result.shown) for (const r of shown) expect(r.score).toBeGreaterThanOrEqual(result.cutoff!);
  });

  test("método que só ordena (RRF) não corta, nem com corte pedido: sempre mostra o top inteiro", () => {
    const result = recommend(methodById("sections-rrf"), pool, 2, "relative");
    expect(result.cutoff).toBeNull();
    expect(result.shown.every((shown) => shown.length === 2)).toBe(true);
  });
});

test("método desconhecido diz quais existem", () => expect(() => methodById("magic")).toThrow(/Opções: whole/));

test("prepareDataset monta a ficha e os vetores de cada currículo do conjunto", async () => {
  const resumes = EXTRACTION_EXAMPLES.map((example, k) => ({ id: `r${k}`, ...example.expected }));
  const { profiles, candidates } = await prepareDataset(
    { referenceMonth: EXAMPLES_REFERENCE_MONTH, resumes },
    fakeEmbeddings,
  );
  expect(profiles.map((p) => p.id)).toEqual(["r0", "r1", "r2"]);
  expect(candidates.map((c) => c.jobs.length)).toEqual(resumes.map((r) => r.experiences.length));
});

test("seção vazia nos dois currículos não conta como semelhança", () => {
  const withoutEducation = (id: string, direction: UnitVector): Candidate => {
    const c = candidate(id, direction);
    return { ...c, sections: { ...c.sections, education: null } };
  };
  const method = methodById("sections");
  const both = method.rank(0, [withoutEducation("A", unit(1, 0, 0)), withoutEducation("B", unit(1, 0, 0))])[0]!.score;
  const full = method.rank(0, [candidate("A", unit(1, 0, 0)), candidate("B", unit(1, 0, 0))])[0]!.score;
  // Iguais em tudo, mas sem formação: perdem o peso da formação (0,1) em vez de ganhar por "vazio igual".
  expect(full - both).toBeCloseTo(0.1);
});

test("nota mínima: a calibrada do método por padrão, uma fixa quando pedem, ou nenhuma", () => {
  const method = methodById("sections");
  expect(recommend(method, pool, 3).cutoff).toBe(method.minScore);
  expect(recommend(method, pool, 3, 0.5).cutoff).toBe(0.5);
  expect(recommend(method, pool, 3, null)).toMatchObject({
    cutoff: null,
    shown: [expect.any(Array), expect.any(Array), expect.any(Array), expect.any(Array)],
  });
  expect(recommend(method, pool, 3, null).shown.every((shown) => shown.length === 3)).toBe(true);
});

test("todo método que dá nota absoluta tem nota mínima calibrada; os que só ordenam não têm", () => {
  for (const method of allMethods())
    expect(method.minScore === null).toBe(method.id === "sections-rrf" || method.id === "sections-zscore");
});
