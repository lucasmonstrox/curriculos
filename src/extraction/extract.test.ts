import { expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { EXTRACTION_EXAMPLES } from "./examples";
import { createExtractor } from "./extract";
import { EXTRACTION_INSTRUCTIONS } from "./prompt";

/* A extração pelo AI SDK com um modelo falso do `ai/test`: sem rede, sem custo, resposta controlada. */

const expected = EXTRACTION_EXAMPLES[0]!.expected;

/** Modelo que responde a ficha em JSON, com os empregos fora de ordem de propósito. */
const answering = (output: object) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(output) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });

test("manda as instruções, os 3 exemplos como conversa e o currículo com o mês de hoje; devolve a ficha validada e em ordem", async () => {
  const model = answering({ ...expected, experiences: expected.experiences.toReversed() });
  const extract = createExtractor({ model, referenceMonth: () => "2026-11" });

  expect(await extract("Currículo de teste")).toEqual(expected);

  const { prompt } = model.doGenerateCalls[0]!;
  expect(prompt[0]).toEqual({ role: "system", content: EXTRACTION_INSTRUCTIONS });
  expect(prompt.filter((message) => message.role === "assistant")).toHaveLength(EXTRACTION_EXAMPLES.length);
  expect(JSON.stringify(prompt.at(-1))).toContain("Hoje é 2026-11.");
  expect(JSON.stringify(prompt.at(-1))).toContain("Currículo de teste");
});

test("resposta fora do formato é recusada (o Zod valida na volta)", async () => {
  const extract = createExtractor({ model: answering({ headline: "só isso" }) });
  expect(extract("Currículo de teste")).rejects.toThrow();
});

test("sem modelo, usa o da OpenAI (criar não chama a API)", () => {
  process.env.OPENAI_API_KEY ??= "chave-de-teste";
  expect(createExtractor()).toBeFunction();
});
