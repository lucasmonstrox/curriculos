import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import type { z } from "zod";

/* Leitura e escrita de arquivos. Toda leitura de JSON passa por um schema: arquivo torto para aqui,
   com a mensagem do Zod, em vez de estourar longe dali. */

export async function readJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(await Bun.file(path).json());
}

export async function writeJson(path: string, value: unknown, { pretty = true } = {}): Promise<void> {
  await writeText(path, JSON.stringify(value, null, pretty ? 2 : undefined) + "\n");
}

export async function writeText(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, text);
}

/** Apaga e recria uma pasta de saída, para não sobrar arquivo de uma rodada anterior. */
export async function resetDirectory(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
  await mkdir(path, { recursive: true });
}
