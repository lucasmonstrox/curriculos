import type { Dataset } from "../domain/dataset";
import { type Section, SECTIONS } from "../domain/sections";
import type { EmbeddingProvider } from "../embedding/provider";
import { buildProfile, type Profile } from "../profile/profile";
import { parseMonth } from "../utils/month";
import { normalize, type UnitVector } from "../utils/vector";

/** Um emprego como os métodos enxergam: o vetor e o tempo, que serve de peso. */
export type JobVector = { vector: UnitVector; years: number; yearsSinceEnd: number };

/** O que os métodos de semelhança enxergam de cada currículo. */
export type Candidate = {
  id: string;
  whole: UnitVector;
  /**
   * Um vetor por seção; null quando a seção está vazia no currículo (sem formação, por exemplo). Seção
   * vazia não vira vetor: dois currículos sem formação não podem ganhar nota por "terem o mesmo vazio".
   */
  sections: Record<Section, UnitVector | null>;
  jobs: readonly JobVector[];
};

/**
 * Gera os vetores de todas as fichas num pedido só ao provedor e remonta por currículo. A ordem dos
 * textos é a ordem de leitura abaixo: ficha inteira, as seções que têm texto, depois cada emprego.
 */
export async function embedCandidates(profiles: readonly Profile[], provider: EmbeddingProvider): Promise<Candidate[]> {
  const texts = profiles.flatMap((p) => [
    p.whole,
    ...SECTIONS.flatMap((s) => (p.sections[s] ? [p.sections[s]] : [])),
    ...p.jobs.map((j) => j.text),
  ]);
  const vectors = (await provider.embed(texts)).map(normalize);

  let next = 0;
  const take = (): UnitVector => vectors[next++]!;
  return profiles.map((profile) => ({
    id: profile.id,
    whole: take(),
    sections: Object.fromEntries(
      SECTIONS.map((s) => [s, profile.sections[s] ? take() : null]),
    ) as Candidate["sections"],
    jobs: profile.jobs.map((job) => ({ vector: take(), years: job.years, yearsSinceEnd: job.yearsSinceEnd })),
  }));
}

/** Fichas e vetores de um conjunto inteiro em arquivo (linha de comando e laboratório). */
export async function prepareDataset(
  dataset: Dataset,
  provider: EmbeddingProvider,
): Promise<{ profiles: Profile[]; candidates: Candidate[] }> {
  const reference = parseMonth(dataset.referenceMonth);
  const profiles = dataset.resumes.map((resume) => buildProfile(resume, reference));
  return { profiles, candidates: await embedCandidates(profiles, provider) };
}
