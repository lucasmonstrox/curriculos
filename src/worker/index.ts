import { connectDatabase } from "@/db/client";
import { defaultEmbeddingProvider } from "@/embedding";
import { createExtractor } from "@/extraction/extract";
import { createProcessingService, type ProcessOutcome } from "@/resumes/processing";
import { readEnv } from "@/utils/env";
import { runWorker } from "./loop";

/*
 * Entrada do worker: `bun run worker`. Processa a fila de currículos até Ctrl+C. Pode rodar mais de
 * um ao mesmo tempo: o SKIP LOCKED da fila garante que cada currículo vai para um worker só.
 */

const { db, close } = connectDatabase(readEnv().DATABASE_URL);
const processing = createProcessingService({ db, embeddings: defaultEmbeddingProvider(), extract: createExtractor() });

const controller = new AbortController();
process.on("SIGINT", () => controller.abort());
process.on("SIGTERM", () => controller.abort());

/** Uma linha de log por currículo; o erro técnico (que a API não mostra) aparece só aqui. */
const describe = (outcome: Exclude<ProcessOutcome, { kind: "idle" }>): string => {
  switch (outcome.kind) {
    case "ready":
      return `${outcome.id}: pronto`;
    case "lost":
      return `${outcome.id}: outro worker retomou; este resultado foi descartado`;
    case "retry":
      return `${outcome.id}: falhou, volta para a fila (${outcome.error})`;
    case "failed":
      return `${outcome.id}: falhou em todas as tentativas (${outcome.error})`;
  }
};

console.log("Worker processando a fila (Ctrl+C para parar).");
await runWorker(processing, {
  signal: controller.signal,
  log: (outcome) => console.log(describe(outcome)),
  onError: (error) => console.error("Erro no worker; tenta de novo em instantes:", error),
});
await close();
