import { datasetSchema } from "@/domain/dataset";
import { careerSummary } from "@/domain/summary";
import { connectDatabase } from "@/db/client";
import { cachedEmbeddingProvider } from "@/embedding";
import { readJson, resetDirectory, writeText } from "@/io/files";
import { PATHS } from "@/io/paths";
import { prepareDataset } from "@/similarity/candidates";
import { DEFAULT_METHOD_ID, METHOD_IDS, methodById } from "@/similarity/methods";
import { DEFAULT_TOP, recommend } from "@/similarity/recommend";
import { readEnv } from "@/utils/env";
import { parseMonth } from "@/utils/month";
import { positiveInt, readArgs } from "@/utils/args";

/*
 * `bun run recommend [conjunto.json] [--method jobs-duration] [--top 3]`: recomenda, para cada
 * currículo de um conjunto em arquivo, os mais parecidos entre os outros do mesmo conjunto. Grava as
 * fichas em out/profiles/ e a lista legível em out/recommendations.txt. Padrão: o conjunto que o
 * `bun run extract` gera.
 */

const { values, positionals } = readArgs({
  method: { type: "string", default: DEFAULT_METHOD_ID },
  top: { type: "string", default: String(DEFAULT_TOP) },
});
const path = positionals[0] ?? PATHS.extractedDataset;
const method = methodById(values.method);
const top = positiveInt(values.top, "top");

const dataset = await readJson(path, datasetSchema);
const { db, close } = connectDatabase(readEnv().DATABASE_URL); // os vetores ficam no cache do Postgres
const { profiles, candidates } = await prepareDataset(dataset, cachedEmbeddingProvider(db));
await close();
const result = recommend(method, candidates, top);
const reference = parseMonth(dataset.referenceMonth);

await resetDirectory(PATHS.profiles);
await Promise.all(profiles.map((profile) => writeText(`${PATHS.profiles}/${profile.id}.md`, profile.whole + "\n")));

const lines = [
  `Método: ${method.label} (outros: ${METHOD_IDS.filter((id) => id !== method.id).join(", ")}).`,
  `Nota mínima: ${result.cutoff === null ? "sem corte" : result.cutoff.toFixed(3)}.`,
  "",
  ...dataset.resumes.flatMap((resume, index) => [
    `${resume.id} · ${resume.headline}`,
    `  ${careerSummary(resume, reference)}`,
    ...(result.shown[index]!.length
      ? result.shown[index]!.map(
          ({ index: other, score }) =>
            `  → ${dataset.resumes[other]!.id} · ${dataset.resumes[other]!.headline} (${score.toFixed(3)})`,
        )
      : ["  → nenhum currículo parecido o bastante"]),
    "",
  ]),
];
await writeText(PATHS.recommendations, lines.join("\n"));
console.log(lines.join("\n"));
console.log(`Fichas em ${PATHS.profiles}/ e esta lista em ${PATHS.recommendations}.`);
