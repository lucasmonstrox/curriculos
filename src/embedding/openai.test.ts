import { expect, test } from "bun:test";
import { MockEmbeddingModelV4 } from "ai/test";
import { openAIEmbeddings } from "./openai";

/* O embedding pelo `embedMany` do AI SDK, com um modelo falso do `ai/test`. */

test("devolve um vetor por texto, na ordem, e pede as dimensões cortadas à OpenAI", async () => {
  const model = new MockEmbeddingModelV4({
    doEmbed: async ({ values }) => ({ embeddings: values.map((value) => [value.length, 1]), warnings: [] }),
  });
  const provider = openAIEmbeddings({ modelId: "modelo-x", dimensions: 2048, model });

  expect(provider.id).toBe("openai/modelo-x@2048");
  expect(await provider.embed(["a", "bbb"])).toEqual([
    [1, 1],
    [3, 1],
  ]);
  expect(model.doEmbedCalls[0]!.providerOptions).toEqual({ openai: { dimensions: 2048 } });
});
