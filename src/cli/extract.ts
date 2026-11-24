import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { Dataset } from "@/domain/dataset";
import { createExtractor } from "@/extraction/extract";
import { writeJson } from "@/io/files";
import { PATHS } from "@/io/paths";
import { currentMonth } from "@/utils/month";
import { slugify } from "@/utils/text";
import { readArgs } from "@/utils/args";

/*
 * `bun run extract <arquivo ou pasta> [...]`: lê currículos em texto (.txt ou .md) com o modelo de
 * linguagem e grava uma ficha por arquivo em out/extracted/, mais um conjunto com todas
 * (out/extracted/dataset.json), pronto para `bun run recommend`. Sem argumento, lê samples/.
 */

const TEXT_EXTENSIONS = new Set([".txt", ".md"]);

const { positionals } = readArgs({});
const inputs = positionals.length ? positionals : ["samples"];

/** Os arquivos de texto de cada argumento: o próprio arquivo, ou os de dentro da pasta. */
async function textFiles(path: string): Promise<string[]> {
  if (!(await stat(path)).isDirectory()) return [path];
  return (await readdir(path)).filter((name) => TEXT_EXTENSIONS.has(extname(name))).map((name) => join(path, name));
}

const files = (await Promise.all(inputs.map(textFiles))).flat().sort();
if (!files.length) throw new Error(`Nenhum .txt ou .md em: ${inputs.join(", ")}`);

const extract = createExtractor();
const resumes: Dataset["resumes"] = [];
for (const file of files) {
  // O id vem do nome do arquivo: "Ana Souza.txt" vira "ana-souza".
  const id = slugify(basename(file, extname(file)));
  const started = performance.now();
  const data = await extract(await Bun.file(file).text());
  resumes.push({ id, ...data });
  await writeJson(`${PATHS.extracted}/${id}.json`, data);
  console.log(
    `${file}: ${data.headline}, ${data.experiences.length} empregos (${((performance.now() - started) / 1000).toFixed(1)} s)`,
  );
}

if (resumes.length >= 2) {
  await writeJson(PATHS.extractedDataset, { referenceMonth: currentMonth(), resumes } satisfies Dataset);
  console.log(`\nConjunto com ${resumes.length} currículos em ${PATHS.extractedDataset}: rode \`bun run recommend\`.`);
}
