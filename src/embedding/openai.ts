import type { OpenAIEmbeddingModelOptions } from "@ai-sdk/openai";
import { type EmbeddingModel, embedMany } from "ai";
import { OPENAI_TIMEOUT_MS, openAI } from "../lib/openai";
import type { EmbeddingProvider } from "./provider";

export type OpenAIEmbeddingOptions = {
  modelId: string;
  dimensions: number;
  /** O modelo do AI SDK; padrão: o da OpenAI. Os testes passam um modelo falso do `ai/test`. */
  model?: EmbeddingModel;
};

// Pedidos simultâneos à API. O `embedMany` já divide em lotes no limite do modelo; mais de 2 em
// paralelo esbarra no limite de taxa de contas novas sem ganho real com poucas centenas de textos.
const MAX_PARALLEL_CALLS = 2;

/** Embedding da OpenAI pelo `embedMany` do AI SDK, cortado para `dimensions` (Matryoshka). */
export function openAIEmbeddings({
  modelId,
  dimensions,
  model = openAI().embedding(modelId),
}: OpenAIEmbeddingOptions): EmbeddingProvider {
  return {
    id: `openai/${modelId}@${dimensions}`,
    async embed(texts) {
      const { embeddings } = await embedMany({
        model,
        values: [...texts],
        maxParallelCalls: MAX_PARALLEL_CALLS,
        abortSignal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
        providerOptions: { openai: { dimensions } satisfies OpenAIEmbeddingModelOptions },
      });
      return embeddings;
    },
  };
}
