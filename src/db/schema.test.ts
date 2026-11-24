import { expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { embeddingCache, resumes, resumeVectors } from "./schema";

/* O que o schema promete e o resto do código pressupõe. */

test("vetores: apagar o currículo apaga os vetores (ON DELETE CASCADE)", () => {
  const [foreignKey] = getTableConfig(resumeVectors).foreignKeys;
  expect(foreignKey!.onDelete).toBe("cascade");
  expect(foreignKey!.reference().foreignTable).toBe(resumes);
});

test("vetores: índice HNSW por cosseno só na ficha inteira, que é por onde a busca pré-seleciona", () => {
  const [index] = getTableConfig(resumeVectors).indexes;
  expect(index!.config.name).toBe("resume_vectors_whole_hnsw");
  expect(index!.config.method).toBe("hnsw");
  expect(index!.config.where).toBeDefined();
});

test("currículos: sem ficha e sem texto não entra na fila; a fila tem índice por status e chegada", () => {
  const config = getTableConfig(resumes);
  expect(config.checks.map((check) => check.name)).toEqual(["resumes_has_content"]);
  expect(config.indexes.map((index) => index.config.name)).toEqual(["resumes_queue"]);
});

test("vetores em halfvec de 2048 dimensões, no cache e nos currículos", () => {
  for (const table of [resumeVectors, embeddingCache]) {
    const column = getTableConfig(table).columns.find((c) => c.name === "embedding")!;
    expect(column.getSQLType()).toBe("halfvec(2048)");
  }
});
