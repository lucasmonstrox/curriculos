import { base, Faker, pt_BR } from "@faker-js/faker";
import { parseMonth } from "@/utils/month";
import { type LabDataset, labDatasetSchema } from "../dataset";
import { NEIGHBORS, PROFESSION_IDS, PROFESSIONS } from "./catalog/professions";
import { createRandom } from "./random";
import { generateResume } from "./resume";

/*
 * Conjunto sintético de currículos com gabarito. O "agora" é fixo: a mesma semente gera o mesmo
 * conjunto em qualquer dia, então dá para comparar métodos e mudanças em cima dos mesmos dados.
 */
export const DEFAULT_REFERENCE_MONTH = "2026-11";

export type GenerateOptions = { seed: number; size: number; referenceMonth?: string };

export function generateDataset({ seed, size, referenceMonth = DEFAULT_REFERENCE_MONTH }: GenerateOptions): LabDataset {
  const rng = createRandom(seed);
  // Faker próprio do conjunto, com a mesma semente: os dados pessoais também se repetem por semente.
  const faker = new Faker({ locale: [pt_BR, base] });
  faker.seed(seed);
  const reference = parseMonth(referenceMonth);
  const generated = Array.from({ length: size }, (_, index) => ({
    id: `c${String(index + 1).padStart(2, "0")}`,
    ...generateResume(rng, faker, reference),
  }));

  // Passa pelo schema: se o gerador produzir algo fora do formato, quebra aqui e não lá na frente.
  return labDatasetSchema.parse({
    referenceMonth,
    seed,
    resumes: generated.map(({ id, resume }) => ({ id, ...resume })),
    truth: {
      professions: Object.fromEntries(PROFESSION_IDS.map((id) => [id, PROFESSIONS[id].occupation])),
      neighbors: NEIGHBORS,
      careers: Object.fromEntries(generated.map(({ id, current, months }) => [id, { current, months }])),
    },
  });
}
