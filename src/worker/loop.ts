import type { ProcessingService, ProcessOutcome } from "@/resumes/processing";

/*
 * O laço do worker: processa um currículo atrás do outro enquanto houver fila; com a fila vazia,
 * espera IDLE_DELAY_MS e olha de novo. Para no fim do currículo em andamento quando `signal` dispara
 * (Ctrl+C), sem largar nada pela metade.
 *
 * Um erro fora do processamento de um currículo (o banco caiu, por exemplo) não derruba o worker:
 * vai para `onError`, o laço espera o mesmo intervalo e tenta de novo.
 */

const IDLE_DELAY_MS = 1000;

export type WorkerOptions = {
  signal: AbortSignal;
  log?: (outcome: Exclude<ProcessOutcome, { kind: "idle" }>) => void;
  onError?: (error: unknown) => void;
};

export async function runWorker(
  processing: ProcessingService,
  { signal, log = () => {}, onError = (error) => console.error(error) }: WorkerOptions,
): Promise<void> {
  while (!signal.aborted) {
    try {
      const outcome = await processing.processNext();
      if (outcome.kind === "idle") await sleep(IDLE_DELAY_MS, signal);
      else log(outcome);
    } catch (error) {
      onError(error);
      await sleep(IDLE_DELAY_MS, signal);
    }
  }
}

/** Espera `ms`, mas acorda na hora se o worker for parado (antes ou durante a espera). */
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });
