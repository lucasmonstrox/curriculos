import { parseArgs, type ParseArgsConfig } from "node:util";
import { z } from "zod";

/*
 * Leitura das opções de linha de comando (`--seed 7`). Os valores chegam como texto; os números
 * passam pelo Zod para que `--seed abc` pare com mensagem clara em vez de virar NaN lá na frente.
 */

export function readArgs<const Options extends NonNullable<ParseArgsConfig["options"]>>(options: Options) {
  return parseArgs({ options, allowPositionals: true });
}

export function positiveInt(value: string | undefined, name: string): number {
  const message = `--${name} precisa ser um inteiro positivo`;
  return z.coerce.number({ error: message }).int(message).positive(message).parse(value);
}

/** "1,2,3" → [1, 2, 3]. */
export const intList = (value: string | undefined, name: string): number[] =>
  (value ?? "").split(",").map((item) => positiveInt(item.trim(), name));
