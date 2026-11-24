import { describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { resumes } from "@/db/schema";
import { createProcessingService, MAX_ATTEMPTS, STALE_AFTER_MINUTES } from "@/resumes/processing";
import { createResumesRepository } from "@/resumes/repository";
import { useTestDatabase } from "../support/database";
import { buildResumes } from "../support/factories";
import { fakeEmbeddings, fakeExtractor } from "../support/fakes";

/*
 * A fila no Postgres, direto no repositório: é aqui que moram as garantias de que dois workers nunca
 * processam o mesmo currículo, de que um worker atrasado não sobrescreve o trabalho de outro e de que
 * um currículo problemático não roda para sempre.
 */

const db = useTestDatabase();
const repository = createResumesRepository(db);
const [data] = buildResumes(1);
const enqueue = (id: string) => repository.insert({ id, data: data!, sourceText: null });
const processing = () => createProcessingService({ db, embeddings: fakeEmbeddings, extract: fakeExtractor });

const queue = { staleAfterMinutes: STALE_AFTER_MINUTES, maxAttempts: MAX_ATTEMPTS };
// Prazo de 0 minutos: todo currículo em processamento conta como "parado há muito tempo".
const everyoneStale = { ...queue, staleAfterMinutes: 0 };

describe("quem pega o quê", () => {
  test("com a primeira linha travada por outra transação, o worker pega a seguinte na hora (SKIP LOCKED)", async () => {
    await enqueue("res_a");
    await enqueue("res_b");
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM resumes WHERE id = 'res_a' FOR UPDATE`);
      // Sem SKIP LOCKED, o claim esperaria esta transação terminar e a corrida acabaria no "esperou".
      const claimed = await Promise.race([repository.claimNext(queue), Bun.sleep(2_000).then(() => "esperou")]);
      expect(claimed).toMatchObject({ id: "res_b", status: "processing" });
    });
  });

  test("cinco workers ao mesmo tempo dividem três currículos sem repetir nenhum", async () => {
    for (const id of ["res_a", "res_b", "res_c"]) await enqueue(id);
    const claims = await Promise.all(Array.from({ length: 5 }, () => repository.claimNext(queue)));
    expect(claims.flatMap((claim) => (claim ? [claim.id] : [])).toSorted()).toEqual(["res_a", "res_b", "res_c"]);
  });

  test("pega o mais antigo primeiro e conta a tentativa", async () => {
    await enqueue("res_first");
    await enqueue("res_second");
    expect(await repository.claimNext(queue)).toMatchObject({ id: "res_first", status: "processing", attempts: 1 });
  });

  test("currículo em processamento não é pego de novo enquanto não passa do prazo", async () => {
    await enqueue("res_a");
    await repository.claimNext(queue);
    expect(await repository.claimNext(queue)).toBeUndefined();
  });

  test("currículo travado além do prazo (worker morreu) volta para outro worker", async () => {
    await enqueue("res_a");
    await repository.claimNext(queue);
    expect(await repository.claimNext(everyoneStale)).toMatchObject({ id: "res_a", attempts: 2 });
  });

  test("ready e failed não voltam para a fila", async () => {
    await enqueue("res_ready");
    await processing().processNext();
    await enqueue("res_failed");
    const claim = await repository.claimNext(queue);
    await repository.saveFailure(claim!, { error: "erro", status: "failed", retryInSeconds: 0 });
    expect(await repository.claimNext(everyoneStale)).toBeUndefined();
  });
});

describe("falhas", () => {
  test("depois de uma falha, a nova tentativa espera o tempo pedido", async () => {
    await enqueue("res_a");
    const claim = await repository.claimNext(queue);
    await repository.saveFailure(claim!, { error: "erro", status: "queued", retryInSeconds: 60 });
    expect(await repository.claimNext(queue)).toBeUndefined();
    await db
      .update(resumes)
      .set({ runAfter: sql`now()` })
      .where(eq(resumes.id, "res_a"));
    expect(await repository.claimNext(queue)).toMatchObject({ id: "res_a", attempts: 2 });
  });

  test("currículo que derrubou o worker em todas as tentativas vira failed, e não roda para sempre", async () => {
    await enqueue("res_a");
    await repository.claimNext(queue);
    for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt++) await repository.claimNext(everyoneStale);
    // Gastou as tentativas: mesmo parado além do prazo, não é retomado...
    expect(await repository.claimNext(everyoneStale)).toBeUndefined();
    // ...e a faxina marca como falha.
    expect(await repository.failAbandoned({ ...everyoneStale, error: "interrompido" })).toBe(1);
    expect(await repository.findById("res_a")).toMatchObject({ status: "failed", lastError: "interrompido" });
  });

  test("requeue só mexe em currículo que falhou, e zera as tentativas", async () => {
    await enqueue("res_a");
    expect(await repository.requeue("res_a")).toBeUndefined();
    const claim = await repository.claimNext(queue);
    await repository.saveFailure(claim!, { error: "erro", status: "failed", retryInSeconds: 600 });
    expect(await repository.requeue("res_a")).toMatchObject({ status: "queued", attempts: 0, lastError: null });
    expect(await repository.claimNext(queue)).toMatchObject({ id: "res_a" });
  });
});

describe("posse", () => {
  test("o worker atrasado, já substituído por outro, não grava nada", async () => {
    await enqueue("res_a");
    const slow = await repository.claimNext(queue);
    const fresh = await repository.claimNext(everyoneStale);

    expect(await repository.saveExtracted(slow!, data!)).toBe(false);
    expect(await repository.saveReady(slow!, data!, [])).toBe(false);
    expect(await repository.saveFailure(slow!, { error: "erro", status: "failed", retryInSeconds: 0 })).toBe(false);
    expect(await repository.findById("res_a")).toMatchObject({ status: "processing", attempts: 2 });

    expect(await repository.saveFailure(fresh!, { error: "erro", status: "queued", retryInSeconds: 0 })).toBe(true);
  });
});

describe("pré-seleção da recomendação", () => {
  test("devolve mais candidatos que o padrão do HNSW (40), até o tamanho pedido", async () => {
    for (const [k, resume] of buildResumes(50).entries())
      await repository.insert({ id: `res_${String(k).padStart(2, "0")}`, data: resume, sourceText: null });
    const worker = processing();
    while ((await worker.processNext()).kind !== "idle");

    const pool = await repository.loadSimilarityPool("res_00", 100);
    expect(pool).toHaveLength(50);
    expect(pool![0]!.id).toBe("res_00");
    expect(await repository.loadSimilarityPool("res_00", 10)).toHaveLength(11);
  });

  test("currículo pedido que não está pronto devolve null", async () => {
    await enqueue("res_a");
    expect(await repository.loadSimilarityPool("res_a", 10)).toBeNull();
  });

  test("candidato com vetores, mas que não está mais pronto, não entra", async () => {
    await enqueue("res_query");
    await enqueue("res_requeued");
    const worker = processing();
    while ((await worker.processNext()).kind !== "idle");
    await db.update(resumes).set({ status: "queued" }).where(eq(resumes.id, "res_requeued"));
    expect((await repository.loadSimilarityPool("res_query", 10))!.map((resume) => resume.id)).toEqual(["res_query"]);
  });
});
