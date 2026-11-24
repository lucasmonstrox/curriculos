import type { Database } from "../db/client";
import { withPostgresCache } from "./cache";
import { EMBEDDING_MODEL } from "./model";
import { openAIEmbeddings } from "./openai";
import type { EmbeddingProvider } from "./provider";

export { EMBEDDING_MODEL } from "./model";
export type { EmbeddingProvider } from "./provider";

/**
 * O embedding do worker: OpenAI pelo AI SDK, sem cache. Os vetores de um currículo ficam só em
 * resume_vectors, então apagar o currículo apaga de fato todos eles (LGPD).
 */
export const defaultEmbeddingProvider = (): EmbeddingProvider =>
  openAIEmbeddings({ modelId: EMBEDDING_MODEL.model, dimensions: EMBEDDING_MODEL.dimensions });

/**
 * O da linha de comando e do laboratório, que geram os mesmos textos muitas vezes: o mesmo provedor
 * com o cache no Postgres (tabela embedding_cache) na frente.
 */
export const cachedEmbeddingProvider = (db: Database): EmbeddingProvider =>
  withPostgresCache(defaultEmbeddingProvider(), db);
