import { expect, test } from "bun:test";
import { EXAMPLES_REFERENCE_MONTH, EXTRACTION_EXAMPLES } from "../extraction/examples";
import { buildProfile } from "../profile/profile";
import { embedCandidates } from "../similarity/candidates";
import { parseMonth } from "../utils/month";
import { cosine } from "../utils/vector";
import { fakeEmbeddings } from "../../test/support/fakes";
import { toCandidate, toVectorRows } from "./vectors";

const reference = parseMonth(EXAMPLES_REFERENCE_MONTH);
const data = EXTRACTION_EXAMPLES[0]!.expected;

test("ida e volta: o candidato gravado e lido de novo é o mesmo", async () => {
  const [candidate] = await embedCandidates([buildProfile({ id: "res_a", ...data }, reference)], fakeEmbeddings);
  const rows = toVectorRows(candidate!);
  expect(rows.map((row) => `${row.kind}#${row.position}`)).toEqual([
    "whole#0",
    "profile#0",
    "skills#0",
    "experience#0",
    "education#0",
    ...data.experiences.map((_, k) => `job#${k}`),
  ]);
  // Os vetores voltam normalizados de novo: iguais até a última casa de ponto flutuante.
  const back = toCandidate("res_a", data, rows, reference);
  expect(cosine(back.whole, candidate!.whole)).toBeCloseTo(1, 10);
  back.jobs.forEach((job, k) => {
    expect(cosine(job.vector, candidate!.jobs[k]!.vector)).toBeCloseTo(1, 10);
    expect(job).toMatchObject({ years: candidate!.jobs[k]!.years, yearsSinceEnd: candidate!.jobs[k]!.yearsSinceEnd });
  });
});

test("seção vazia não vira linha, e volta como null", async () => {
  const noSkills = { ...data, skills: [] };
  const [candidate] = await embedCandidates([buildProfile({ id: "res_a", ...noSkills }, reference)], fakeEmbeddings);
  expect(candidate!.sections.skills).toBeNull();
  const rows = toVectorRows(candidate!);
  expect(rows.some((row) => row.kind === "skills")).toBe(false);
  expect(toCandidate("res_a", noSkills, rows, reference).sections.skills).toBeNull();
});

test("currículo pronto sem o vetor da ficha inteira é dado quebrado, não recomendação pela metade", () =>
  expect(() => toCandidate("res_a", data, [], reference)).toThrow("Currículo res_a sem o vetor whole#0."));
