import type { Database } from "../db/client";
import type { EmbeddingProvider } from "../embedding/provider";
import type { Extractor } from "../extraction/extract";
import { buildProfile } from "../profile/profile";
import { embedCandidates } from "../similarity/candidates";
import { currentMonthStart } from "../utils/month";
import { createResumesRepository } from "./repository";
import { toVectorRows } from "./vectors";

/*
 * O processamento da fila: o worker (src/worker) chama `processNext` em laço. Cada chamada pega um
 * currículo, extrai a ficha se ele chegou como texto, gera os vetores e grava tudo como `ready`.
 *
 * Falha (modelo fora do ar, limite de taxa, ficha inválida) volta para a fila e é tentada de novo
 * depois de uma espera que dobra a cada vez, até MAX_ATTEMPTS; depois vira `failed` e só volta pela
 * rota de tentar de novo. Quem chama a API vê uma mensagem segura; o erro técnico vai só para o log.
 */

export const MAX_ATTEMPTS = 3;

// Um currículo em `processing` há mais que isto é de um worker que morreu no meio: outro pode retomar.
// Bem acima do prazo de cada chamada à OpenAI (OPENAI_TIMEOUT_MS, src/lib/openai.ts).
export const STALE_AFTER_MINUTES = 10;

// Espera antes da nova tentativa: 30 s depois da 1ª falha, 60 s depois da 2ª. Dá tempo de um limite de
// taxa passar, em vez de gastar as tentativas em segundos.
export const RETRY_BASE_DELAY_SECONDS = 30;
export const retryDelaySeconds = (attempt: number): number => RETRY_BASE_DELAY_SECONDS * 2 ** (attempt - 1);

/** Em que passo falhou, para a mensagem segura dizer o que deu errado sem expor o erro técnico. */
type Stage = "extraction" | "embedding" | "saving";

export const SAFE_ERRORS: Record<Stage | "abandoned", string> = {
  extraction: "Não foi possível ler o currículo com o modelo de linguagem.",
  embedding: "Não foi possível gerar os vetores do currículo.",
  saving: "Não foi possível gravar o currículo processado.",
  abandoned: "O processamento foi interrompido em todas as tentativas.",
};

export type ProcessingDependencies = { db: Database; embeddings: EmbeddingProvider; extract: Extractor };

export type ProcessOutcome =
  | { kind: "idle" }
  | { kind: "ready"; id: string }
  // Outro worker retomou o currículo enquanto este trabalhava: o trabalho deste é descartado.
  | { kind: "lost"; id: string }
  | { kind: "retry" | "failed"; id: string; error: string };

export function createProcessingService({ db, embeddings, extract }: ProcessingDependencies) {
  const repository = createResumesRepository(db);
  const queue = { staleAfterMinutes: STALE_AFTER_MINUTES, maxAttempts: MAX_ATTEMPTS };

  return {
    async processNext(): Promise<ProcessOutcome> {
      await repository.failAbandoned({ ...queue, error: SAFE_ERRORS.abandoned });
      const job = await repository.claimNext(queue);
      if (!job) return { kind: "idle" };

      let stage: Stage = "extraction";
      try {
        // A tabela garante que existe a ficha ou o texto (CHECK resumes_has_content).
        let data = job.data;
        if (!data) {
          data = await extract(job.sourceText!);
          stage = "saving";
          if (!(await repository.saveExtracted(job, data))) return { kind: "lost", id: job.id };
        }
        stage = "embedding";
        const [candidate] = await embedCandidates(
          [buildProfile({ id: job.id, ...data }, currentMonthStart())],
          embeddings,
        );
        stage = "saving";
        const saved = await repository.saveReady(job, data, toVectorRows(candidate!));
        return saved ? { kind: "ready", id: job.id } : { kind: "lost", id: job.id };
      } catch (error) {
        // `attempts` já conta esta tentativa (o claim soma 1).
        const giveUp = job.attempts >= MAX_ATTEMPTS;
        await repository.saveFailure(job, {
          error: SAFE_ERRORS[stage],
          status: giveUp ? "failed" : "queued",
          retryInSeconds: retryDelaySeconds(job.attempts),
        });
        return {
          kind: giveUp ? "failed" : "retry",
          id: job.id,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export type ProcessingService = ReturnType<typeof createProcessingService>;
