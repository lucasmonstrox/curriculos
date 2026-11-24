import {
  AREA_LABELS,
  EDUCATION_LABELS,
  LANGUAGE_LEVEL_LABELS,
  SECTOR_LABELS,
  SENIORITY_LABELS,
} from "../domain/labels";
import type { Experience, Resume } from "../domain/resume";
import { type Section, SECTIONS } from "../domain/sections";
import { careerSummary } from "../domain/summary";
import { experienceMonths, experienceSpan } from "../domain/timeline";
import { monthsBetween } from "../utils/month";

/*
 * A ficha: o currículo escrito como texto para virar vetor.
 *
 * Cada seção vira um vetor, e cada emprego vira outro. Medido no benchmark (README): separar as
 * seções e os empregos ganha da ficha inteira num vetor só, porque numa ficha longa a experiência
 * ocupa quase todo o texto e abafa o perfil e as habilidades.
 *
 * Nada do bloco `personal` nem das preferências entra aqui: nome, contato, cidade e pretensão não
 * dizem nada da profissão e são dados pessoais (LGPD).
 */

export const SECTION_TITLES: Record<Section, string> = {
  profile: "Perfil",
  skills: "Habilidades",
  experience: "Experiência profissional",
  education: "Formação",
};

/** Um emprego visto sozinho: o texto que vira vetor e o tempo, que serve de peso na comparação. */
export type Job = { text: string; years: number; yearsSinceEnd: number };

export type Profile = {
  id: string;
  sections: Record<Section, string>;
  /** As quatro seções juntas, com títulos: a ficha inteira, para ler e para o método de vetor único. */
  whole: string;
  jobs: Job[];
};

export function buildProfile(resume: Resume, reference: Date): Profile {
  const sections: Record<Section, string> = {
    // O resumo diz o tempo em cada profissão; sem isso, o cargo atual domina a seção (ver README).
    profile: [
      resume.headline,
      `Área: ${AREA_LABELS[resume.area]}. Nível: ${SENIORITY_LABELS[resume.seniority]}.`,
      careerSummary(resume, reference),
    ].join("\n"),
    skills: resume.skills.join(", "),
    experience: resume.experiences.map(describeExperience).join("\n\n"),
    education: [
      ...resume.education.map(
        (e) => `${[e.course, e.institution].filter(Boolean).join(", ")} (${EDUCATION_LABELS[e.level]})`,
      ),
      ...(resume.certifications.length ? [`Certificações: ${resume.certifications.join(", ")}`] : []),
      ...(resume.languages.length
        ? [`Idiomas: ${resume.languages.map((l) => `${l.language} ${LANGUAGE_LEVEL_LABELS[l.level]}`).join(", ")}`]
        : []),
    ].join("\n"),
  };
  return {
    id: resume.id,
    sections,
    whole: SECTIONS.map((s) => `# ${SECTION_TITLES[s]}\n${sections[s]}`).join("\n\n"),
    jobs: resume.experiences.map((experience) => ({
      // A empresa fica fora do texto do emprego: o que aproxima dois empregos é o trabalho feito.
      text: `${experience.title} (${SECTOR_LABELS[experience.sector]})\n${bullets(experience.activities)}`,
      years: experienceMonths(experience, reference) / 12,
      yearsSinceEnd: monthsBetween(experienceSpan(experience, reference).end, reference) / 12,
    })),
  };
}

function describeExperience(experience: Experience): string {
  const period = `${experience.start} a ${experience.end ?? "atual"}`;
  return `## ${experience.title}, ${experience.company} (${SECTOR_LABELS[experience.sector]}, ${period})\n${bullets(experience.activities)}`;
}

const bullets = (items: readonly string[]): string => items.map((item) => `- ${item}`).join("\n");
