import { intList, positiveInt, readArgs } from "@/utils/args";
import { connectDatabase } from "@/db/client";
import { cachedEmbeddingProvider, EMBEDDING_MODEL } from "@/embedding";
import { writeJson } from "@/io/files";
import { prepareDataset } from "@/similarity/candidates";
import { allMethods, DEFAULT_METHOD_ID, type MethodId } from "@/similarity/methods";
import { recommend } from "@/similarity/recommend";
import { readEnv } from "@/utils/env";
import { deviation, mean } from "@/utils/stats";
import { type Evaluation, evaluate } from "../evaluation/metrics";
import { groundTruth } from "../evaluation/truth";
import { generateDataset } from "../generator";
import { LAB_PATHS } from "../paths";

/*
 * `bun run lab:benchmark [--seeds 1,2,3,4,5,7] [--size 40] [--top 3]`: compara todos os métodos de
 * semelhança nos mesmos conjuntos sintéticos e imprime a média e o desvio entre sorteios. Um método
 * só ganha de outro se ganhar na maioria dos sorteios: diferença menor que o desvio é empate.
 *
 * A coluna "corte médio" é a média do corte relativo (média menos 2 desvios) de cada método: é de onde
 * sai a nota mínima calibrada de cada um (minScore em src/similarity/methods.ts).
 */

const { values } = readArgs({
  seeds: { type: "string", default: "1,2,3,4,5,7" },
  size: { type: "string", default: "40" },
  top: { type: "string", default: "3" },
  baseline: { type: "string", default: "sections" },
});
const seeds = intList(values.seeds, "seeds");
const size = positiveInt(values.size, "size");
const top = positiveInt(values.top, "top");
const methods = allMethods();
const { db, close } = connectDatabase(readEnv().DATABASE_URL); // os vetores ficam no cache do Postgres
const provider = cachedEmbeddingProvider(db);

type Run = { seed: number; results: Record<MethodId, Evaluation & { cutoff: number | null }> };
const runs: Run[] = [];
for (const seed of seeds) {
  const dataset = generateDataset({ seed, size });
  const { candidates } = await prepareDataset(dataset, provider);
  const truth = groundTruth(dataset);
  const results = {} as Run["results"];
  for (const method of methods) {
    // Corte relativo: é o que se mede aqui para calibrar a nota mínima de cada método.
    const result = recommend(method, candidates, top, "relative");
    results[method.id] = { ...evaluate(result, truth.matrix, truth.mixed, top), cutoff: result.cutoff };
  }
  runs.push({ seed, results });
  console.log(`semente ${seed} pronta`);
}

const spread = (values: number[]) => `${mean(values).toFixed(3)} ± ${deviation(values).toFixed(3)}`;
const baseline = values.baseline as MethodId;
console.log(
  `\n${EMBEDDING_MODEL.model} (${EMBEDDING_MODEL.dimensions} dimensões), ${size} currículos por sorteio, top ${top}\n`,
);
console.table(
  Object.fromEntries(
    methods.map((method) => {
      const of = (pick: (e: Run["results"][MethodId]) => number) => runs.map((run) => pick(run.results[method.id]));
      const wins = runs.filter((run) => run.results[method.id].ndcg > run.results[baseline].ndcg).length;
      return [
        `${method.id}${method.id === DEFAULT_METHOD_ID ? " (padrão)" : ""}`,
        {
          "ordem do top (1 = perfeita)": spread(of((e) => e.ndcg)),
          "só carreiras mistas": spread(of((e) => e.ndcgMixed)),
          "1º entre os melhores": `${(100 * mean(of((e) => e.firstIsRight))).toFixed(1)}%`,
          [`ganha de ${baseline}`]: method.id === baseline ? "-" : `${wins}/${runs.length}`,
          "corte médio": method.minScore === null ? "não corta" : mean(of((e) => e.cutoff!)).toFixed(3),
        },
      ];
    }),
  ),
);

await close();
await writeJson(LAB_PATHS.benchmark, { model: EMBEDDING_MODEL, size, top, runs });
console.log(`Números de cada sorteio em ${LAB_PATHS.benchmark}.`);
