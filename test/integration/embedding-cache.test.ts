import { expect, test } from "bun:test";
import { cachedEmbeddingProvider, defaultEmbeddingProvider } from "@/embedding";
import { withPostgresCache } from "@/embedding/cache";
import type { EmbeddingProvider } from "@/embedding/provider";
import { useTestDatabase } from "../support/database";
import { fakeEmbeddings } from "../support/fakes";

/* O cache de embeddings na tabela embedding_cache (pgvector). */

const db = useTestDatabase();

/** Provedor que conta quantos textos pediram vetor a ele (e gera pelo embedding falso). */
function counting(id = "fake") {
  const asked: string[] = [];
  const provider: EmbeddingProvider = {
    id,
    embed: async (texts) => (asked.push(...texts), fakeEmbeddings.embed(texts)),
  };
  return { provider, asked };
}

test("o mesmo texto só é gerado uma vez, inclusive por outra instância (o cache é o banco)", async () => {
  const first = counting();
  await withPostgresCache(first.provider, db).embed(["a", "bb", "a"]);
  expect(first.asked).toEqual(["a", "bb"]);

  const second = counting();
  const vectors = await withPostgresCache(second.provider, db).embed(["bb", "ccc"]);
  expect(second.asked).toEqual(["ccc"]);
  expect(vectors).toHaveLength(2);
  // Volta do halfvec (16 bits) quase igual ao que entrou.
  expect(vectors[0]![0]).toBeCloseTo((await fakeEmbeddings.embed(["bb"]))[0]![0]!, 2);
});

test("trocar de modelo não reaproveita o vetor de outro modelo", async () => {
  await withPostgresCache(counting("modelo-a").provider, db).embed(["a"]);
  const other = counting("modelo-b");
  await withPostgresCache(other.provider, db).embed(["a"]);
  expect(other.asked).toEqual(["a"]);
});

test("muitos textos passam em lotes (mais de 500 numa chamada)", async () => {
  const texts = Array.from({ length: 1_100 }, (_, k) => `texto ${k}`);
  const { provider, asked } = counting();
  expect(await withPostgresCache(provider, db).embed(texts)).toHaveLength(1_100);
  expect(asked).toHaveLength(1_100);
  const again = counting();
  await withPostgresCache(again.provider, db).embed(texts);
  expect(again.asked).toEqual([]);
});

test("o worker usa o text-embedding-3-large em 2048 dimensões sem cache; a linha de comando, com o cache no banco", () => {
  process.env.OPENAI_API_KEY ??= "chave-de-teste"; // criar o cliente não chama a OpenAI
  expect(defaultEmbeddingProvider().id).toBe("openai/text-embedding-3-large@2048");
  expect(cachedEmbeddingProvider(db).id).toBe("openai/text-embedding-3-large@2048");
});
