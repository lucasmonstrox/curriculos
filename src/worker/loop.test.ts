import { expect, spyOn, test } from "bun:test";
import type { ProcessingService, ProcessOutcome } from "@/resumes/processing";
import { runWorker } from "./loop";

/** Processamento falso que devolve uma sequência de resultados e para o worker quando a fila acaba. */
function scripted(outcomes: ProcessOutcome[], stop: () => void): ProcessingService {
  return {
    processNext: async () => {
      const outcome = outcomes.shift() ?? { kind: "idle" };
      if (outcome.kind === "idle") stop();
      return outcome;
    },
  };
}

test("processa um atrás do outro, avisa cada resultado e para quando mandam parar", async () => {
  const controller = new AbortController();
  const logged: ProcessOutcome[] = [];
  const outcomes: ProcessOutcome[] = [
    { kind: "ready", id: "res_a" },
    { kind: "retry", id: "res_b", error: "erro" },
  ];
  await runWorker(
    scripted([...outcomes], () => controller.abort()),
    {
      signal: controller.signal,
      log: (outcome) => logged.push(outcome),
    },
  );
  expect(logged).toEqual(outcomes);
});

test("parar durante a espera da fila vazia acorda o worker na hora (sem esperar o intervalo)", async () => {
  const controller = new AbortController();
  // Processa um (sem `log`: o padrão não faz nada), acha a fila vazia e só então manda parar.
  const processing = scripted([{ kind: "ready", id: "res_a" }], () => setTimeout(() => controller.abort(), 20));
  const started = performance.now();
  await runWorker(processing, { signal: controller.signal });
  expect(performance.now() - started).toBeLessThan(500);
});

test("erro fora do processamento de um currículo não derruba o worker: avisa e continua", async () => {
  const controller = new AbortController();
  const errors: unknown[] = [];
  let calls = 0;
  const flaky: ProcessingService = {
    processNext: async () => {
      calls++;
      if (calls === 1) throw new Error("banco fora do ar");
      controller.abort();
      return { kind: "idle" };
    },
  };
  await runWorker(flaky, { signal: controller.signal, onError: (error) => errors.push(error) });
  expect(errors).toEqual([new Error("banco fora do ar")]);
  expect(calls).toBe(2);
});

test("sem onError, o erro vai para o console", async () => {
  const controller = new AbortController();
  const logged = spyOn(console, "error").mockImplementation(() => {});
  const failing: ProcessingService = {
    processNext: async () => {
      controller.abort();
      throw new Error("falha");
    },
  };
  await runWorker(failing, { signal: controller.signal });
  expect(logged).toHaveBeenCalledWith(new Error("falha"));
  logged.mockRestore();
});
