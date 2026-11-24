import { describe, expect, test } from "bun:test";
import { intList, positiveInt, readArgs } from "./args";
import { formatMonth, monthsBetween, parseMonth } from "./month";
import { deviation, mean } from "./stats";
import { slugify } from "./text";
import { cosine, normalize } from "./vector";

describe("mês AAAA-MM", () => {
  test("ida e volta preserva o mês", () => expect(formatMonth(parseMonth("2024-03"))).toBe("2024-03"));
  test("mês com um dígito ou fora de 01 a 12 é recusado", () => {
    expect(() => parseMonth("2024-3")).toThrow();
    expect(() => parseMonth("2024-13")).toThrow();
  });
  test("meses de calendário entre dois meses", () =>
    expect(monthsBetween(parseMonth("2024-01"), parseMonth("2025-04"))).toBe(15));
});

describe("vetores unitários", () => {
  test("normalizar deixa a norma em 1 e o cosseno consigo mesmo em 1", () => {
    const v = normalize([3, 4]);
    expect(v).toEqual([0.6, 0.8] as unknown as typeof v);
    expect(cosine(v, v)).toBeCloseTo(1);
  });
  test("vetores ortogonais têm cosseno 0", () => expect(cosine(normalize([1, 0]), normalize([0, 2]))).toBe(0));
  test("vetor nulo não normaliza e dimensões diferentes não comparam", () => {
    expect(() => normalize([0, 0])).toThrow();
    expect(() => cosine(normalize([1, 0]), normalize([1, 0, 0]))).toThrow();
  });
});

describe("pequenos utilitários", () => {
  test("desvio populacional", () => {
    expect(mean([2, 4, 4, 4, 5, 5, 7, 9])).toBe(5);
    expect(deviation([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });
  test("slug sem acento e com separador", () => {
    expect(slugify("Analista de Sucesso do Cliente")).toBe("analista-de-sucesso-do-cliente");
    expect(slugify("Técnico de manutenção")).toBe("tecnico-de-manutencao");
    expect(slugify("João", ".")).toBe("joao");
  });
});

describe("opções de linha de comando", () => {
  test("inteiro positivo; texto ou zero param com a mensagem da opção", () => {
    expect(positiveInt("7", "seed")).toBe(7);
    expect(() => positiveInt("abc", "seed")).toThrow("--seed precisa ser um inteiro positivo");
    expect(() => positiveInt("0", "seed")).toThrow();
  });
  test("lista de inteiros separada por vírgula", () => expect(intList("1, 2,7", "seeds")).toEqual([1, 2, 7]));
  test("lê opções com padrão e argumentos soltos", () => {
    const original = process.argv;
    process.argv = ["bun", "script.ts", "pasta", "--top", "5"];
    const { values, positionals } = readArgs({
      top: { type: "string", default: "3" },
      seed: { type: "string", default: "7" },
    });
    process.argv = original;
    expect(values).toEqual({ top: "5", seed: "7" });
    expect(positionals).toEqual(["pasta"]);
  });
});
