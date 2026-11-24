import { createResumesService } from "@/api/features/resumes/services/resumes";
import { positiveInt, readArgs } from "@/utils/args";
import { connectDatabase } from "@/db/client";
import { readEnv } from "@/utils/env";
import { generateDataset } from "../generator";

/*
 * `bun run lab:seed [--seed 7] [--size 40]`: põe currículos sintéticos na fila do banco, pelo mesmo
 * caminho da API (já estruturados, só falta gerar os vetores). Com o worker rodando, eles viram
 * `ready` e dá para testar GET /resumes/{id}/similar com dados de verdade.
 */

const { values } = readArgs({ seed: { type: "string", default: "7" }, size: { type: "string", default: "40" } });
const dataset = generateDataset({ seed: positiveInt(values.seed, "seed"), size: positiveInt(values.size, "size") });

const { db, close } = connectDatabase(readEnv().DATABASE_URL);
const service = createResumesService({ db });
for (const { id: _syntheticId, ...data } of dataset.resumes) await service.enqueueData(data);
await close();
console.log(
  `${dataset.resumes.length} currículos na fila (semente ${dataset.seed}). Rode \`bun run worker\` para processar.`,
);
