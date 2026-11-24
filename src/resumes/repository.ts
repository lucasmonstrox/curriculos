import { and, cosineDistance, desc, eq, gte, inArray, lt, lte, ne, or, type SQL, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { type ResumeRow, type ResumeVectorRow, resumes, resumeVectors } from "../db/schema";
import type { ExtractedResume } from "../domain/resume";
import type { ResumeStatus } from "../domain/status";

/*
 * Consultas e gravações dos currículos e dos vetores, inclusive a fila. Só lê e grava: quem decide
 * (quantas tentativas, quanto esperar, o que é "parado há muito tempo") é quem chama, e passa por
 * parâmetro. Todo "agora" é o now() do banco, não o relógio de cada máquina que roda um worker.
 */

export type ResumeVectors = Pick<ResumeVectorRow, "kind" | "position" | "embedding">;

/**
 * Quem pegou um currículo da fila: o id e o número da tentativa. Funciona como posse: só grava quem
 * ainda tem a tentativa atual. Um worker lento, já substituído por outro depois do prazo, não sobrescreve
 * o trabalho do novo.
 */
export type Claim = Pick<ResumeRow, "id" | "attempts">;

/** Um currículo pronto com os vetores, como a recomendação precisa. */
export type ReadyResume = { id: string; data: ExtractedResume; vectors: ResumeVectors[] };

const minutesAgo = (minutes: number): SQL => sql`now() - make_interval(mins => ${minutes})`;

const ownedBy = ({ id, attempts }: Claim) =>
  and(eq(resumes.id, id), eq(resumes.status, "processing"), eq(resumes.attempts, attempts));

// O índice HNSW é parcial (kind = 'whole'): o planejador só o usa se a consulta trouxer o mesmo
// predicado escrito literal, e não como parâmetro ($1).
const isWhole = sql`${resumeVectors.kind} = 'whole'`;

export function createResumesRepository(db: Database) {
  return {
    async insert(row: { id: string; data: ExtractedResume | null; sourceText: string | null }): Promise<ResumeRow> {
      const [created] = await db.insert(resumes).values(row).returning();
      return created!;
    },

    async findById(id: string): Promise<ResumeRow | undefined> {
      const [row] = await db.select().from(resumes).where(eq(resumes.id, id));
      return row;
    },

    /**
     * Do mais novo para o mais antigo, depois do `cursor` (o último id da página anterior). Os ids têm
     * formato fixo ("res_" + UUID v7 em minúsculas), então a ordem do texto é a ordem de criação em
     * qualquer collation, e a chave primária serve de índice.
     */
    list({ limit, cursor, status }: { limit: number; cursor?: string; status?: ResumeStatus }): Promise<ResumeRow[]> {
      return db
        .select()
        .from(resumes)
        .where(and(cursor ? lt(resumes.id, cursor) : undefined, status ? eq(resumes.status, status) : undefined))
        .orderBy(desc(resumes.id))
        .limit(limit);
    },

    /** Apaga o currículo; os vetores vão junto (ON DELETE CASCADE). Diz se havia o que apagar. */
    async remove(id: string): Promise<boolean> {
      const deleted = await db.delete(resumes).where(eq(resumes.id, id)).returning({ id: resumes.id });
      return deleted.length > 0;
    },

    /** Põe de volta na fila um currículo que falhou, zerando as tentativas, para pegar já. */
    async requeue(id: string): Promise<ResumeRow | undefined> {
      const [row] = await db
        .update(resumes)
        .set({ status: "queued", attempts: 0, lastError: null, claimedAt: null, runAfter: sql`now()` })
        .where(and(eq(resumes.id, id), eq(resumes.status, "failed")))
        .returning();
      return row;
    },

    /**
     * Desiste dos currículos presos em `processing` além do prazo que já gastaram as tentativas: o
     * worker morreu no meio de todas elas (o currículo derruba o processo, por exemplo). Sem isto, eles
     * seriam retomados para sempre. Devolve quantos marcou.
     */
    async failAbandoned({
      staleAfterMinutes,
      maxAttempts,
      error,
    }: {
      staleAfterMinutes: number;
      maxAttempts: number;
      error: string;
    }): Promise<number> {
      const failed = await db
        .update(resumes)
        .set({ status: "failed", lastError: error, claimedAt: null })
        .where(
          and(
            eq(resumes.status, "processing"),
            lt(resumes.claimedAt, minutesAgo(staleAfterMinutes)),
            gte(resumes.attempts, maxAttempts),
          ),
        )
        .returning({ id: resumes.id });
      return failed.length;
    },

    /**
     * Pega o próximo currículo da fila para um worker: o mais antigo em `queued` cuja espera já passou
     * (`run_after`), ou um em `processing` pego há mais de `staleAfterMinutes` (o worker que pegou
     * morreu) que ainda tem tentativa. O SELECT ... FOR UPDATE SKIP LOCKED dentro do UPDATE faz dois
     * workers ao mesmo tempo nunca pegarem o mesmo currículo: o segundo pula a linha travada pelo
     * primeiro e pega a seguinte, sem esperar.
     */
    async claimNext({
      staleAfterMinutes,
      maxAttempts,
    }: {
      staleAfterMinutes: number;
      maxAttempts: number;
    }): Promise<ResumeRow | undefined> {
      const next = db
        .select({ id: resumes.id })
        .from(resumes)
        .where(
          or(
            and(eq(resumes.status, "queued"), lte(resumes.runAfter, sql`now()`)),
            and(
              eq(resumes.status, "processing"),
              lt(resumes.claimedAt, minutesAgo(staleAfterMinutes)),
              lt(resumes.attempts, maxAttempts),
            ),
          ),
        )
        .orderBy(resumes.createdAt)
        .limit(1)
        .for("update", { skipLocked: true });
      const [claimed] = await db
        .update(resumes)
        .set({ status: "processing", claimedAt: sql`now()`, attempts: sql`${resumes.attempts} + 1` })
        .where(inArray(resumes.id, next))
        .returning();
      return claimed;
    },

    /** Grava a ficha extraída, se ainda for o dono: uma nova tentativa não paga a extração de novo. */
    async saveExtracted(claim: Claim, data: ExtractedResume): Promise<boolean> {
      const saved = await db.update(resumes).set({ data }).where(ownedBy(claim)).returning({ id: resumes.id });
      return saved.length > 0;
    },

    /**
     * Grava a ficha e os vetores e marca `ready`, tudo ou nada: ninguém vê um currículo pronto pela
     * metade. Se outro worker já retomou o currículo, não grava nada e devolve false.
     */
    async saveReady(claim: Claim, data: ExtractedResume, vectors: readonly ResumeVectors[]): Promise<boolean> {
      return db.transaction(async (tx) => {
        const owned = await tx
          .update(resumes)
          .set({ status: "ready", data, lastError: null, claimedAt: null })
          .where(ownedBy(claim))
          .returning({ id: resumes.id });
        if (!owned.length) return false;
        // Reprocessar (tentar de novo) troca os vetores antigos pelos novos.
        await tx.delete(resumeVectors).where(eq(resumeVectors.resumeId, claim.id));
        await tx.insert(resumeVectors).values(vectors.map((vector) => ({ resumeId: claim.id, ...vector })));
        return true;
      });
    },

    /**
     * Registra a falha, se ainda for o dono: volta para a fila depois de `retryInSeconds` (`queued`) ou
     * desiste (`failed`), conforme quem chama decidiu.
     */
    async saveFailure(
      claim: Claim,
      { error, status, retryInSeconds }: { error: string; status: "queued" | "failed"; retryInSeconds: number },
    ): Promise<boolean> {
      const saved = await db
        .update(resumes)
        .set({
          status,
          lastError: error,
          claimedAt: null,
          runAfter: sql`now() + make_interval(secs => ${retryInSeconds})`,
        })
        .where(ownedBy(claim))
        .returning({ id: resumes.id });
      return saved.length > 0;
    },

    /**
     * O currículo pedido (primeiro da lista) e os `poolSize` prontos mais perto dele pelo vetor da ficha
     * inteira, cada um com todos os vetores. É a pré-seleção barata (índice HNSW, aproximado) antes da
     * nota exata, que quem chama calcula. Devolve null se o currículo pedido não está pronto.
     *
     * Tudo numa transação REPEATABLE READ: as três consultas veem o mesmo retrato do banco, então um
     * candidato apagado no meio não aparece sem vetores.
     */
    async loadSimilarityPool(id: string, poolSize: number): Promise<ReadyResume[] | null> {
      return db.transaction(
        async (tx) => {
          // O HNSW devolve no máximo `hnsw.ef_search` linhas (padrão 40) antes do filtro, e o próprio
          // currículo pedido (o mais perto de si mesmo) é uma delas e sai no filtro: sem subir o limite
          // para poolSize + 1, viriam 39 candidatos, ou poolSize - 1. Vale só nesta transação (o `true`).
          await tx.execute(sql`SELECT set_config('hnsw.ef_search', ${String(poolSize + 1)}, true)`);
          const target = tx
            .select({ embedding: resumeVectors.embedding })
            .from(resumeVectors)
            .where(and(eq(resumeVectors.resumeId, id), isWhole));
          const nearest = await tx
            .select({ resumeId: resumeVectors.resumeId })
            .from(resumeVectors)
            .where(and(isWhole, ne(resumeVectors.resumeId, id)))
            .orderBy(cosineDistance(resumeVectors.embedding, target))
            .limit(poolSize);

          const ids = [id, ...nearest.map((row) => row.resumeId)];
          const rows = await tx
            .select({ id: resumes.id, data: resumes.data })
            .from(resumes)
            .where(and(inArray(resumes.id, ids), eq(resumes.status, "ready")));
          const vectors = await tx
            .select({
              resumeId: resumeVectors.resumeId,
              kind: resumeVectors.kind,
              position: resumeVectors.position,
              embedding: resumeVectors.embedding,
            })
            .from(resumeVectors)
            .where(inArray(resumeVectors.resumeId, ids));

          const dataById = new Map(rows.map((row) => [row.id, row.data]));
          const vectorsById = Map.groupBy(vectors, (vector) => vector.resumeId);
          // Só entra quem está pronto: tem ficha e vetores. O pedido precisa ser um deles.
          const ready = ids.flatMap((resumeId) => {
            const data = dataById.get(resumeId);
            const resumeVectorsList = vectorsById.get(resumeId);
            return data && resumeVectorsList ? [{ id: resumeId, data, vectors: resumeVectorsList }] : [];
          });
          return ready[0]?.id === id ? ready : null;
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}

export type ResumesRepository = ReturnType<typeof createResumesRepository>;
