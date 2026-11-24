import { positiveInt, readArgs } from "@/utils/args";
import { writeJson } from "@/io/files";
import { generateDataset } from "../generator";
import { LAB_PATHS } from "../paths";

/*
 * `bun run lab:generate [--seed 7] [--size 40]`: gera um conjunto sintético com gabarito em
 * out/lab-dataset.json. O arquivo serve também ao `bun run recommend out/lab-dataset.json`.
 */

const { values } = readArgs({ seed: { type: "string", default: "7" }, size: { type: "string", default: "40" } });
const dataset = generateDataset({ seed: positiveInt(values.seed, "seed"), size: positiveInt(values.size, "size") });
await writeJson(LAB_PATHS.dataset, dataset);

/** "chave n, chave n", da mais comum para a menos. */
const count = (keys: readonly string[]) =>
  Object.entries(Object.groupBy(keys, (key) => key))
    .map(([key, items]) => [key, items!.length] as const)
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => `${key} ${n}`)
    .join(", ");

const careers = Object.values(dataset.truth.careers);
console.log(`${dataset.resumes.length} currículos (semente ${dataset.seed}) em ${LAB_PATHS.dataset}`);
console.log(`profissões por carreira: ${count(careers.map((c) => String(Object.keys(c.months).length)))}`);
console.log(`empregos por currículo: ${count(dataset.resumes.map((r) => String(r.experiences.length)))}`);
console.log(`profissão de hoje: ${count(careers.map((c) => dataset.truth.professions[c.current] ?? c.current))}`);
