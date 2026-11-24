import { describe, expect, mock, test } from "bun:test";
import { addSeconds } from "date-fns";
import { eq, sql } from "drizzle-orm";
import { embeddingCache, resumes, resumeVectors } from "@/db/schema";
import type { EmbeddingProvider } from "@/embedding/provider";
import { EXTRACTION_EXAMPLES } from "@/extraction/examples";
import type { Extractor } from "@/extraction/extract";
import { createProcessingService, MAX_ATTEMPTS, retryDelaySeconds, SAFE_ERRORS } from "@/resumes/processing";
import { createResumesRepository } from "@/resumes/repository";
import { useTestDatabase } from "../support/database";
import { buildResumes } from "../support/factories";
import { fakeEmbeddings, fakeExtractor } from "../support/fakes";

/* O processamento de um currículo da fila, com o banco de verdade e a OpenAI substituída. */

const db = useTestDatabase();
const repository = createResumesRepository(db);
const [data] = buildResumes(1);
const text = EXTRACTION_EXAMPLES[0]!.text;

const offline: EmbeddingProvider = {
  id: "offline",
  embed: async () => {
    throw new Error("Limite de taxa (simulado).");
  },
};

/** Libera a espera entre tentativas, para o teste não precisar esperar 30 segundos. */
const skipRetryWait = () => db.update(resumes).set({ runAfter: sql`now()` });

/** Simula outro worker retomando o currículo no meio do trabalho deste (a tentativa sobe). */
const anotherWorkerTakesOver = (id: string) =>
  db
    .update(resumes)
    .set({ attempts: sql`${resumes.attempts} + 1` })
    .where(eq(resumes.id, id));

describe("caminho feliz", () => {
  test("fila vazia: o worker fica ocioso", async () => {
    expect(
      await createProcessingService({ db, embeddings: fakeEmbeddings, extract: fakeExtractor }).processNext(),
    ).toEqual({
      kind: "idle",
    });
  });

  test("currículo já estruturado não chama o modelo de linguagem; grava a ficha inteira, as seções e 1 vetor por emprego", async () => {
    const extract = mock(fakeExtractor);
    await repository.insert({ id: "res_a", data: data!, sourceText: null });

    expect(await createProcessingService({ db, embeddings: fakeEmbeddings, extract }).processNext()).toEqual({
      kind: "ready",
      id: "res_a",
    });
    expect(extract).not.toHaveBeenCalled();
    const vectors = await db.select().from(resumeVectors).where(eq(resumeVectors.resumeId, "res_a"));
    const kinds = vectors.map((v) => v.kind);
    expect(kinds.filter((kind) => kind === "whole")).toHaveLength(1);
    expect(kinds.filter((kind) => kind === "job")).toHaveLength(data!.experiences.length);
  });

  test("currículo em texto passa pela extração e fica pronto com a ficha extraída", async () => {
    await repository.insert({ id: "res_a", data: null, sourceText: text });
    await createProcessingService({ db, embeddings: fakeEmbeddings, extract: fakeExtractor }).processNext();
    expect(await repository.findById("res_a")).toMatchObject({
      status: "ready",
      data: EXTRACTION_EXAMPLES[0]!.expected,
    });
  });

  test("o worker não usa o cache de embeddings: apagar o currículo apaga todos os vetores dele", async () => {
    await repository.insert({ id: "res_a", data: data!, sourceText: null });
    await createProcessingService({ db, embeddings: fakeEmbeddings, extract: fakeExtractor }).processNext();
    expect(await db.select().from(embeddingCache)).toEqual([]);
  });
});

describe("falhas", () => {
  test("falha no embedding volta para a fila com mensagem segura e espera antes da nova tentativa", async () => {
    await repository.insert({ id: "res_a", data: data!, sourceText: null });
    const before = new Date();
    expect(await createProcessingService({ db, embeddings: offline, extract: fakeExtractor }).processNext()).toEqual({
      kind: "retry",
      id: "res_a",
      error: "Limite de taxa (simulado).",
    });
    const row = await repository.findById("res_a");
    expect(row).toMatchObject({ status: "queued", attempts: 1, lastError: SAFE_ERRORS.embedding, claimedAt: null });
    // O erro técnico fica no resultado (vai para o log), não no banco.
    expect(row!.lastError).not.toContain("Limite de taxa");
    expect(row!.runAfter.getTime()).toBeGreaterThanOrEqual(addSeconds(before, retryDelaySeconds(1) - 5).getTime());
  });

  test("a ficha extraída é guardada antes do embedding: a nova tentativa não paga a extração de novo", async () => {
    await repository.insert({ id: "res_a", data: null, sourceText: text });
    const extract = mock(fakeExtractor);
    await createProcessingService({ db, embeddings: offline, extract }).processNext();
    expect((await repository.findById("res_a"))!.data).toEqual(EXTRACTION_EXAMPLES[0]!.expected);

    await skipRetryWait();
    await createProcessingService({ db, embeddings: fakeEmbeddings, extract }).processNext();
    expect(extract).toHaveBeenCalledTimes(1);
    expect((await repository.findById("res_a"))!.status).toBe("ready");
  });

  test(`falha na extração tenta de novo e desiste na tentativa ${MAX_ATTEMPTS}`, async () => {
    const failing: Extractor = async () => Promise.reject("texto solto, não Error");
    const worker = createProcessingService({ db, embeddings: fakeEmbeddings, extract: failing });
    await repository.insert({ id: "res_a", data: null, sourceText: text });

    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      expect(await worker.processNext()).toMatchObject({ kind: "retry", error: "texto solto, não Error" });
      await skipRetryWait();
    }
    expect(await worker.processNext()).toMatchObject({ kind: "failed", id: "res_a" });
    expect(await repository.findById("res_a")).toMatchObject({
      status: "failed",
      attempts: MAX_ATTEMPTS,
      lastError: SAFE_ERRORS.extraction,
    });
  });

  test("currículo abandonado em todas as tentativas (worker morreu) vira failed na próxima volta do worker", async () => {
    await repository.insert({ id: "res_a", data: data!, sourceText: null });
    await db
      .update(resumes)
      .set({ status: "processing", attempts: MAX_ATTEMPTS, claimedAt: sql`now() - interval '1 hour'` })
      .where(eq(resumes.id, "res_a"));
    expect(
      await createProcessingService({ db, embeddings: fakeEmbeddings, extract: fakeExtractor }).processNext(),
    ).toEqual({
      kind: "idle",
    });
    expect(await repository.findById("res_a")).toMatchObject({ status: "failed", lastError: SAFE_ERRORS.abandoned });
  });
});

describe("posse", () => {
  test("outro worker retomou durante a extração: o resultado deste é descartado", async () => {
    await repository.insert({ id: "res_a", data: null, sourceText: text });
    const extract: Extractor = async (resumeText) => (await anotherWorkerTakesOver("res_a"), fakeExtractor(resumeText));
    expect(await createProcessingService({ db, embeddings: fakeEmbeddings, extract }).processNext()).toEqual({
      kind: "lost",
      id: "res_a",
    });
    expect((await repository.findById("res_a"))!.data).toBeNull();
  });

  test("outro worker retomou durante o embedding: os vetores deste não são gravados", async () => {
    await repository.insert({ id: "res_a", data: data!, sourceText: null });
    const embeddings: EmbeddingProvider = {
      id: "lento",
      embed: async (texts) => (await anotherWorkerTakesOver("res_a"), fakeEmbeddings.embed(texts)),
    };
    expect(await createProcessingService({ db, embeddings, extract: fakeExtractor }).processNext()).toEqual({
      kind: "lost",
      id: "res_a",
    });
    expect(await db.select().from(resumeVectors)).toEqual([]);
  });
});

test("gravar de novo troca os vetores em vez de duplicar", async () => {
  const countVectors = async () =>
    Number((await db.execute<{ count: number }>(sql`SELECT count(*) AS count FROM resume_vectors`))[0]!.count);
  await repository.insert({ id: "res_a", data: data!, sourceText: null });
  const worker = createProcessingService({ db, embeddings: fakeEmbeddings, extract: fakeExtractor });
  await worker.processNext();
  const first = await countVectors();
  await db.update(resumes).set({ status: "queued" }).where(eq(resumes.id, "res_a"));
  await worker.processNext();
  expect(await countVectors()).toBe(first);
});
