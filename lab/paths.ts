/* Saídas do laboratório, relativas à raiz do projeto. `docs/exemplos/` vai para o git como
   documentação; `out/` é gerado e fica fora do git. */
export const LAB_PATHS = {
  dataset: "out/lab-dataset.json",
  benchmark: "out/benchmark.json",
  examples: "docs/exemplos",
} as const;
