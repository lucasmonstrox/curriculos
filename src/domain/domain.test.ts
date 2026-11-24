import { describe, expect, test } from "bun:test";
import { EXAMPLES_REFERENCE_MONTH, EXTRACTION_EXAMPLES } from "../extraction/examples";
import { parseMonth } from "../utils/month";
import type { Experience } from "./resume";
import { seniorityByMonths } from "./seniority";
import { careerSummary, describeDuration } from "./summary";
import { careerMonths, experienceMonths } from "./timeline";

const reference = parseMonth(EXAMPLES_REFERENCE_MONTH);
const job = (start: string, end: string | null, occupation = "analista"): Experience => ({
  title: "Cargo",
  occupation,
  company: "Empresa",
  sector: "services",
  start,
  end,
  activities: ["Fez algo."],
});

describe("tempo de carreira", () => {
  test("emprego atual vai até o mês de referência", () =>
    expect(experienceMonths(job("2026-01", null), reference)).toBe(10));
  test("emprego de um mês só conta 1 mês, não 0", () =>
    expect(experienceMonths(job("2020-05", "2020-05"), reference)).toBe(1));
  test("empregos ao mesmo tempo não contam duas vezes", () => {
    const overlapping = [job("2020-01", "2022-01"), job("2021-01", "2022-01")];
    expect(careerMonths(overlapping, reference)).toBe(24);
  });
});

describe("resumo da carreira montado pelo código", () => {
  test("uma profissão: cargo com o tempo total", () => {
    const summary = careerSummary(
      { headline: "Analista de Dados", focus: "Foco em BI.", experiences: [job("2021-11", null)] },
      reference,
    );
    expect(summary).toBe("Analista de Dados com 5 anos de experiência. Foco em BI.");
  });

  test("troca de carreira: tempo em cada profissão, da maior para a menor, e o último cargo", () => {
    const simone = EXTRACTION_EXAMPLES[1]!.expected;
    expect(careerSummary(simone, reference)).toBe(
      "11 anos de experiência: 10 anos como enfermeira, menos de 1 ano como analista de dados. Último cargo: analista de dados. " +
        simone.focus,
    );
  });

  test("tempo por extenso", () => {
    expect(describeDuration(5)).toBe("menos de 1 ano");
    expect(describeDuration(14)).toBe("1 ano");
    expect(describeDuration(30)).toBe("3 anos");
  });
});

describe("régua de nível (a mesma do gerador e do prompt)", () => {
  test.each([
    [0, "junior"],
    [23, "junior"],
    [24, "mid"],
    [59, "mid"],
    [60, "senior"],
    [120, "specialist"],
  ] as const)("%i meses na profissão: %s", (months, level) => expect(seniorityByMonths(months)).toBe(level));
});
