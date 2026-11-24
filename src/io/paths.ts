/* Caminhos padrão da linha de comando, relativos à raiz do projeto. `out/` é gerado e fica fora do git. */
export const PATHS = {
  profiles: "out/profiles",
  recommendations: "out/recommendations.txt",
  extracted: "out/extracted",
  extractedDataset: "out/extracted/dataset.json",
} as const;
