import type { ExtractedResume } from "../domain/resume";
import { SECTIONS } from "../domain/sections";
import { buildProfile } from "../profile/profile";
import type { Candidate } from "../similarity/candidates";
import { normalize } from "../utils/vector";
import type { ResumeVectors } from "./repository";

/*
 * Ida e volta entre o candidato (como a semelhança enxerga o currículo) e as linhas de vetor do banco.
 * Funções puras: sem banco.
 */

/** Os vetores para gravar: a ficha inteira, cada seção que tem texto e cada emprego (pela posição). */
export function toVectorRows(candidate: Candidate): ResumeVectors[] {
  return [
    { kind: "whole", position: 0, embedding: [...candidate.whole] },
    ...SECTIONS.flatMap((section) => {
      const vector = candidate.sections[section];
      return vector ? [{ kind: section, position: 0, embedding: [...vector] }] : [];
    }),
    ...candidate.jobs.map((job, position) => ({ kind: "job" as const, position, embedding: [...job.vector] })),
  ];
}

/**
 * Monta o candidato de um currículo pronto a partir dos vetores gravados. O peso de cada emprego
 * (duração, recência) não é gravado: sai da ficha, com o mês de hoje, porque o emprego atual cresce
 * todo mês. Os vetores são normalizados de novo porque o halfvec arredonda cada número. Seção sem
 * vetor é seção vazia no currículo; ficha inteira ou emprego sem vetor é dado quebrado.
 */
export function toCandidate(
  id: string,
  data: ExtractedResume,
  vectors: readonly ResumeVectors[],
  reference: Date,
): Candidate {
  const find = (kind: ResumeVectors["kind"], position = 0) =>
    vectors.find((vector) => vector.kind === kind && vector.position === position);
  const required = (kind: ResumeVectors["kind"], position = 0) => {
    const vector = find(kind, position);
    if (!vector) throw new Error(`Currículo ${id} sem o vetor ${kind}#${position}.`);
    return normalize(vector.embedding);
  };
  const profile = buildProfile({ id, ...data }, reference);
  return {
    id,
    whole: required("whole"),
    sections: Object.fromEntries(
      SECTIONS.map((section) => {
        const vector = find(section);
        return [section, vector ? normalize(vector.embedding) : null];
      }),
    ) as Candidate["sections"],
    jobs: profile.jobs.map((job, position) => ({
      vector: required("job", position),
      years: job.years,
      yearsSinceEnd: job.yearsSinceEnd,
    })),
  };
}
