import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import type { Database } from "../db/client";
import { embeddingCache } from "../db/schema";
import type { EmbeddingProvider } from "./provider";

/*
 * Cache de embeddings no Postgres (pgvector): todo vetor do projeto mora no banco do Docker. A chave
 * é o hash de (modelo, texto): rodar de novo não paga o mesmo texto duas vezes, e trocar de modelo
 * não reaproveita vetor de outro. Só o hash é guardado, nunca o texto.
 */

// Consultas e inserções em lotes: uma lista de milhares de chaves num IN só fica lenta e pesada.
const BATCH_SIZE = 500;

const batches = <T>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / BATCH_SIZE) }, (_, k) =>
    items.slice(k * BATCH_SIZE, (k + 1) * BATCH_SIZE),
  );

export function withPostgresCache(provider: EmbeddingProvider, db: Database): EmbeddingProvider {
  const keyOf = (text: string) => createHash("sha256").update(`${provider.id}\n${text}`).digest("hex");

  return {
    id: provider.id,
    async embed(texts) {
      const unique = [...new Set(texts)];
      const found = new Map<string, number[]>();
      for (const keys of batches(unique.map(keyOf))) {
        const rows = await db.select().from(embeddingCache).where(inArray(embeddingCache.key, keys));
        for (const row of rows) found.set(row.key, row.embedding);
      }

      const missing = unique.filter((text) => !found.has(keyOf(text)));
      if (missing.length) {
        const vectors = await provider.embed(missing);
        const rows = missing.map((text, i) => ({ key: keyOf(text), embedding: vectors[i]! }));
        // ON CONFLICT DO NOTHING: dois processos que geram o mesmo texto ao mesmo tempo não brigam.
        for (const batch of batches(rows)) await db.insert(embeddingCache).values(batch).onConflictDoNothing();
        for (const row of rows) found.set(row.key, row.embedding);
      }
      return texts.map((text) => found.get(keyOf(text))!);
    },
  };
}
