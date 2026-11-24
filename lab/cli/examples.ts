import { positiveInt, readArgs } from "@/utils/args";
import { connectDatabase } from "@/db/client";
import { cachedEmbeddingProvider, EMBEDDING_MODEL } from "@/embedding";
import { resetDirectory, writeText } from "@/io/files";
import { prepareDataset } from "@/similarity/candidates";
import { DEFAULT_METHOD_ID, methodById } from "@/similarity/methods";
import { recommend } from "@/similarity/recommend";
import { readEnv } from "@/utils/env";
import { findMisses } from "../evaluation/metrics";
import { groundTruth } from "../evaluation/truth";
import { generateDataset } from "../generator";
import { LAB_PATHS } from "../paths";
import { renderExamplePages } from "../render/example-pages";
import { renderGraphPage } from "../render/graph-page";

/*
 * Gera docs/exemplos: um conjunto sintético, as recomendações do método padrão e uma página por
 * currículo. Uso: bun run lab:examples [--seed 7] [--size 40] [--top 3]
 */

const { values } = readArgs({
  seed: { type: "string", default: "7" },
  size: { type: "string", default: "40" },
  top: { type: "string", default: "3" },
});
const top = positiveInt(values.top, "top");

const dataset = generateDataset({ seed: positiveInt(values.seed, "seed"), size: positiveInt(values.size, "size") });
const { db, close } = connectDatabase(readEnv().DATABASE_URL); // os vetores ficam no cache do Postgres
const { profiles, candidates } = await prepareDataset(dataset, cachedEmbeddingProvider(db));
await close();
const method = methodById(DEFAULT_METHOD_ID);
// Corte relativo: o laboratório mostra o corte que os próprios dados sugerem.
const result = recommend(method, candidates, top, "relative");
const truth = groundTruth(dataset);

const input = {
  dataset,
  profiles,
  result,
  truth,
  method,
  misses: findMisses(result, truth.matrix, top),
  embeddingModel: `${EMBEDDING_MODEL.model} (${EMBEDDING_MODEL.dimensions} dimensões)`,
};
const pages = renderExamplePages(input);
pages.set("grafo.html", renderGraphPage(input));

await resetDirectory(LAB_PATHS.examples);
for (const [name, content] of pages) await writeText(`${LAB_PATHS.examples}/${name}`, content);
console.log(
  `${pages.size} arquivos em ${LAB_PATHS.examples}/ (semente ${dataset.seed}, ${method.label}), com o grafo.html.`,
);
