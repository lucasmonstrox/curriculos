import type { ExtractedResume } from "./resume";
import { careerMonths, experienceMonths } from "./timeline";

/*
 * O resumo da carreira, montado pelo código a partir das datas.
 *
 * Por que não pedir ao modelo: conta de datas é onde modelo de linguagem mais erra, e um resumo que
 * diz "Analista de Marketing com 7 anos" quando 5 deles foram em dados é falso e puxa a recomendação
 * para o cargo atual (achado no benchmark, ver README). Aqui o tempo sai exato.
 *
 * Formatos:
 *   uma profissão:   "Desenvolvedor Backend com 11 anos de experiência. {foco}"
 *   várias:          "11 anos de experiência: 10 anos como enfermeiro, menos de 1 ano como analista de
 *                     dados. Último cargo: analista de dados. {foco}"
 *   ("Hoje atua como" no lugar de "Último cargo" quando o emprego mais recente é o atual.)
 */

type CareerFields = Pick<ExtractedResume, "headline" | "focus" | "experiences">;

/** Meses em cada profissão (`occupation`), da que teve mais tempo para a de menos. */
export function monthsByOccupation(experiences: CareerFields["experiences"], reference: Date): [string, number][] {
  const months = new Map<string, number>();
  for (const experience of experiences)
    months.set(
      experience.occupation,
      (months.get(experience.occupation) ?? 0) + experienceMonths(experience, reference),
    );
  return [...months].sort((a, b) => b[1] - a[1]);
}

/** Tempo por extenso, arredondado para anos: "menos de 1 ano", "1 ano", "11 anos". */
export function describeDuration(months: number): string {
  if (months < 12) return "menos de 1 ano";
  const years = Math.round(months / 12);
  return years === 1 ? "1 ano" : `${years} anos`;
}

export function careerSummary(resume: CareerFields, reference: Date): string {
  const total = describeDuration(careerMonths(resume.experiences, reference));
  const occupations = monthsByOccupation(resume.experiences, reference);
  // Os empregos vêm do mais recente para o mais antigo: o primeiro é o de hoje (ou o último que teve).
  const latest = resume.experiences[0]!;

  const opening =
    occupations.length === 1
      ? `${resume.headline} com ${total} de experiência.`
      : `${total} de experiência: ${occupations.map(([name, months]) => `${describeDuration(months)} como ${name}`).join(", ")}. ` +
        `${latest.end === null ? "Hoje atua como" : "Último cargo:"} ${latest.occupation}.`;
  return `${opening} ${resume.focus}`;
}
