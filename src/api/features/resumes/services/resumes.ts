import type { Database } from "@/db/client";
import type { ExtractedResume } from "@/domain/resume";
import { careerSummary } from "@/domain/summary";
import { createResumesRepository } from "@/resumes/repository";
import { toCandidate } from "@/resumes/vectors";
import { DEFAULT_METHOD_ID, methodById } from "@/similarity/methods";
import { DEFAULT_TOP } from "@/similarity/recommend";
import { currentMonthStart } from "@/utils/month";
import { CANDIDATE_POOL, LIST_DEFAULT_LIMIT } from "../consts";
import type { ListResumesQuery, ListResumesResponse } from "../dtos/list-resumes";
import type { QueuedResponse, ResumeResponse } from "../dtos/resume";
import type { SimilarResumesQuery, SimilarResumesResponse } from "../dtos/similar-resumes";
import { resumeNotFailed, resumeNotFound, resumeNotReady } from "../errors";
import { toListItem, toQueuedResponse, toResumeResponse } from "../mappers/resume";

/*
 * Regras das rotas de currículo. Não conhece o Elysia: recebe o dado já validado e devolve o que a
 * rota responde. O trabalho lento (extrair e gerar vetores) não acontece aqui: entrar na fila é só
 * gravar; quem processa é o worker (src/resumes/processing.ts).
 */

/** "res_" + UUID v7: o UUID v7 começa pelo tempo, então a ordem dos ids é a ordem de criação. */
const newResumeId = () => `res_${Bun.randomUUIDv7()}`;

export function createResumesService({ db }: { db: Database }) {
  const repository = createResumesRepository(db);

  async function findOrThrow(id: string) {
    const row = await repository.findById(id);
    if (!row) throw resumeNotFound(id);
    return row;
  }

  return {
    /** Currículo já estruturado: entra na fila só para gerar os vetores. */
    async enqueueData(data: ExtractedResume): Promise<QueuedResponse> {
      return toQueuedResponse(await repository.insert({ id: newResumeId(), data, sourceText: null }));
    },

    /** Currículo em texto: entra na fila para ser extraído e depois gerar os vetores. */
    async enqueueText(text: string): Promise<QueuedResponse> {
      return toQueuedResponse(await repository.insert({ id: newResumeId(), data: null, sourceText: text }));
    },

    async get(id: string): Promise<ResumeResponse> {
      return toResumeResponse(await findOrThrow(id), currentMonthStart());
    },

    /** Uma página da lista. Pede um a mais que o limite só para saber se existe próxima página. */
    async list({ limit = LIST_DEFAULT_LIMIT, cursor, status }: ListResumesQuery): Promise<ListResumesResponse> {
      const rows = await repository.list({ limit: limit + 1, cursor, status });
      const page = rows.slice(0, limit);
      return { items: page.map(toListItem), nextCursor: rows.length > limit ? page.at(-1)!.id : null };
    },

    async remove(id: string): Promise<void> {
      if (!(await repository.remove(id))) throw resumeNotFound(id);
    },

    /** Põe de volta na fila um currículo que falhou. Só `failed`: os outros já estão andando ou prontos. */
    async retry(id: string): Promise<QueuedResponse> {
      const row = await findOrThrow(id);
      if (row.status !== "failed") throw resumeNotFailed(id, row.status);
      const requeued = await repository.requeue(id);
      // Outro pedido mudou o status no meio tempo (tentou de novo, ou o currículo foi apagado).
      if (!requeued) throw resumeNotFailed(id, (await findOrThrow(id)).status);
      return toQueuedResponse(requeued);
    },

    /**
     * Os currículos mais parecidos com `id`. Só currículos prontos entram, dos dois lados: o pedido
     * precisa estar `ready` (409 se não), e os candidatos vêm só dos que têm ficha e vetores.
     */
    async similar(id: string, query: SimilarResumesQuery): Promise<SimilarResumesResponse> {
      const method = methodById(query.method ?? DEFAULT_METHOD_ID);
      // Uma leitura consistente do pedido e dos candidatos. Vazia quando o pedido não está pronto:
      // aí se descobre se ele nem existe (404) ou ainda está na fila (409).
      const loaded = await repository.loadSimilarityPool(id, CANDIDATE_POOL);
      if (!loaded) throw resumeNotReady(id, (await findOrThrow(id)).status);

      const reference = currentMonthStart();
      // O currículo pedido é o primeiro da lista: é a posição 0 que o método compara com os outros.
      const pool = loaded.map(({ id: resumeId, data, vectors }) => toCandidate(resumeId, data, vectors, reference));
      // Nota mínima: a pedida, ou a calibrada para o método; métodos que só ordenam não cortam.
      const minScore = method.minScore === null ? null : (query.minScore ?? method.minScore);

      const items = method
        .rank(0, pool)
        .filter((ranked) => minScore === null || ranked.score >= minScore)
        .slice(0, query.top ?? DEFAULT_TOP)
        .map(({ index, score }) => {
          const { id: resumeId, data } = loaded[index]!;
          return { id: resumeId, headline: data.headline, summary: careerSummary(data, reference), score };
        });
      return { method: method.id, minScore, items };
    },
  };
}

export type ResumesService = ReturnType<typeof createResumesService>;
