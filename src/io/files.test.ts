import { afterAll, expect, test } from "bun:test";
import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { readJson, resetDirectory, writeJson, writeText } from "./files";

const root = join(tmpdir(), `resume-files-${process.pid}`);
afterAll(() => rm(root, { recursive: true, force: true }));

test("grava e lê JSON criando as pastas; a leitura passa pelo schema", async () => {
  const path = join(root, "a", "b.json");
  await writeJson(path, { n: 1 });
  expect(await Bun.file(path).text()).toBe('{\n  "n": 1\n}\n');
  expect(await readJson(path, z.object({ n: z.number() }))).toEqual({ n: 1 });
  expect(readJson(path, z.object({ n: z.string() }))).rejects.toThrow();
});

test("JSON compacto quando pedido", async () => {
  const path = join(root, "compacto.json");
  await writeJson(path, { n: 1 }, { pretty: false });
  expect(await Bun.file(path).text()).toBe('{"n":1}\n');
});

test("recriar a pasta de saída apaga o que sobrou da rodada anterior", async () => {
  const folder = join(root, "saida");
  await writeText(join(folder, "velho.md"), "x");
  await resetDirectory(folder);
  expect(await readdir(folder)).toEqual([]);
});
