import type { ExtractedResume } from "@/domain/resume";
import { generateDataset } from "../../lab/generator";

/*
 * Currículos de teste pelo mesmo gerador do laboratório (Faker com semente fixa, e-mail sempre em
 * @example.com): cada teste cria os próprios dados, sempre iguais de uma execução para outra.
 */
export function buildResumes(count: number, seed = 101): ExtractedResume[] {
  // Um conjunto tem pelo menos 2 currículos (datasetSchema); para pedir 1, gera 2 e fica com o primeiro.
  return generateDataset({ seed, size: Math.max(2, count) })
    .resumes.slice(0, count)
    .map(({ id: _syntheticId, ...data }) => data);
}
