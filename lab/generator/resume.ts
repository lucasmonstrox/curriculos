import type { Faker } from "@faker-js/faker";
import { getYear } from "date-fns";
import { SENIORITY_LABELS } from "@/domain/labels";
import {
  AVAILABILITIES,
  type EducationLevel,
  type Experience,
  type ExtractedResume,
  type Seniority,
  WORK_MODELS,
} from "@/domain/resume";
import { experienceMonths } from "@/domain/timeline";
import { formatMonth } from "@/utils/month";
import {
  CITIES,
  GENERIC_ACTIVITIES,
  POSTGRADUATE_TOPICS,
  TECHNICAL_SCHOOLS,
  UNIVERSITIES,
  UNRELATED_COURSES,
} from "./catalog/people";
import { professionOf, type ProfessionId } from "./catalog/professions";
import { CATALOG_SECTORS, SECTOR_CATALOG } from "./catalog/sectors";
import { type CareerStep, drawCareer } from "./career";
import type { Random } from "./random";

/*
 * Transforma uma carreira sorteada num currículo padronizado, igual ao que a extração entrega: cada
 * emprego com o `occupation` do catálogo e o currículo com uma frase de foco. O resumo com o tempo em
 * cada profissão não é escrito aqui: o código monta a partir das datas (src/domain/summary).
 */

/** Um currículo sintético e o que o gabarito precisa saber dele. */
export type GeneratedResume = {
  resume: ExtractedResume;
  /** Profissão do emprego atual. */
  current: ProfessionId;
  /** Meses em cada profissão: é a verdade contra a qual a recomendação é medida. */
  months: Partial<Record<ProfessionId, number>>;
};

// Pretensão salarial base por nível, em centavos (R$ 8.000,00 = 800000); sorteia de 70% a 140% dela.
const SALARY_BASE_CENTS: Record<Seniority, number> = {
  intern: 200_000,
  junior: 400_000,
  mid: 800_000,
  senior: 1_400_000,
  specialist: 1_800_000,
  lead: 1_600_000,
};

// Chances do que entra no currículo: atividade genérica, certificação por profissão, inglês, espanhol.
const GENERIC_ACTIVITY_CHANCE = 0.2;
const CERTIFICATION_CHANCE = 0.4;
const ENGLISH_CHANCE = 0.75;
const SPANISH_CHANCE = 0.2;
// O curso costuma ser da profissão em que a pessoa passou mais tempo; às vezes de outra da carreira,
// às vezes sem relação nenhuma (formou em Direito e trabalha com dados).
const COURSE_FROM_MAIN_PROFESSION_CHANCE = 0.7;
const UNRELATED_COURSE_CHANCE = 0.1;

export function generateResume(rng: Random, faker: Faker, reference: Date): GeneratedResume {
  const career = drawCareer(rng, reference);
  // O currículo lista do emprego mais recente para o mais antigo; a carreira vem do mais antigo.
  const experiences = career.map((step) => describeStep(rng, step)).reverse();

  const currentStep = career.at(-1)!;
  const current = professionOf(currentStep.profession);
  const months = monthsByProfession(career, experiences.toReversed(), reference);
  const byTime = (Object.entries(months) as [ProfessionId, number][]).sort((a, b) => b[1] - a[1]);

  return {
    current: currentStep.profession,
    months,
    resume: {
      personal: drawPerson(rng, faker),
      headline: rng.pick(current.titles),
      area: current.area,
      seniority: currentStep.seniority,
      focus: rng.pick(current.focus),
      skills: drawSkills(rng, byTime),
      experiences,
      education: drawEducation(rng, career, byTime),
      certifications: [
        ...new Set(
          byTime.flatMap(([id]) => {
            const { certifications } = professionOf(id);
            return certifications.length && rng.chance(CERTIFICATION_CHANCE) ? [rng.pick(certifications)] : [];
          }),
        ),
      ],
      languages: [
        { language: "Português", level: "native" },
        ...(rng.chance(ENGLISH_CHANCE)
          ? [{ language: "Inglês", level: rng.pick(["basic", "intermediate", "advanced", "fluent"] as const) }]
          : []),
        ...(rng.chance(SPANISH_CHANCE)
          ? [{ language: "Espanhol", level: rng.pick(["basic", "intermediate", "advanced"] as const) }]
          : []),
      ],
      preferences: {
        workModels: current.onsiteOnly ? ["onsite"] : rng.sample(WORK_MODELS, rng.int(1, WORK_MODELS.length)),
        contract: rng.weighted([
          ["clt", 2],
          ["pj", 1],
          ["any", 1],
        ] as const),
        availability: rng.pick(AVAILABILITIES),
        // Arredonda para R$ 100,00 (10000 centavos): pretensão real raramente tem centavos.
        salaryExpectationCents:
          Math.round((SALARY_BASE_CENTS[currentStep.seniority] * rng.int(70, 140)) / 100 / 10_000) * 10_000,
      },
    },
  };
}

/** Um emprego da carreira vira experiência: cargo com o nível, empresa e atividades do setor. */
function describeStep(rng: Random, step: CareerStep): Experience {
  const profession = professionOf(step.profession);
  const sector = rng.pick(profession.sectors ?? CATALOG_SECTORS);
  const { products, companies } = SECTOR_CATALOG[sector];
  const fill = (activity: string) =>
    activity
      .replaceAll("{product}", rng.pick(products))
      .replaceAll("{n}", String(rng.int(2, 60)))
      .replaceAll("{pct}", String(rng.int(5, 45)));
  const activities = rng.sample(profession.activities, rng.int(2, 3)).map(fill);
  if (rng.chance(GENERIC_ACTIVITY_CHANCE)) activities.push(rng.pick(GENERIC_ACTIVITIES));

  return {
    title: jobTitle(rng.pick(profession.titles), step.seniority),
    occupation: profession.occupation,
    company: rng.pick(companies),
    sector,
    start: formatMonth(step.start),
    end: step.end === null ? null : formatMonth(step.end),
    activities,
  };
}

/** Cargo com o nível, do jeito que aparece em currículo: "Desenvolvedor Backend Sênior". */
function jobTitle(title: string, seniority: Seniority): string {
  if (seniority === "intern") return `${title} (estágio)`;
  if (seniority === "lead") return `${title} (líder de time)`;
  return `${title} ${SENIORITY_LABELS[seniority]}`;
}

/** Meses em cada profissão, com a mesma conta de duração que a ficha usa (src/domain/timeline). */
function monthsByProfession(
  career: readonly CareerStep[],
  chronological: readonly Experience[],
  reference: Date,
): Partial<Record<ProfessionId, number>> {
  const months: Partial<Record<ProfessionId, number>> = {};
  career.forEach((step, k) => {
    months[step.profession] = (months[step.profession] ?? 0) + experienceMonths(chronological[k]!, reference);
  });
  return months;
}

/** Habilidades de cada profissão da carreira, mais numerosas para a que ocupou mais tempo. */
function drawSkills(rng: Random, byTime: readonly [ProfessionId, number][]): string[] {
  const total = byTime.reduce((sum, [, months]) => sum + months, 0);
  // De 7 a 11 habilidades no total, repartidas pela fração da carreira (pelo menos 1 por profissão).
  const budget = rng.int(7, 11);
  const skills = byTime.flatMap(([id, months]) =>
    rng.sample(professionOf(id).skills, Math.max(1, Math.round((months / total) * budget))),
  );
  return [...new Set(skills)];
}

/** Formação coerente com a carreira: técnica para quem é técnico, superior (às vezes com pós) para os outros. */
function drawEducation(
  rng: Random,
  career: readonly CareerStep[],
  byTime: readonly [ProfessionId, number][],
): ExtractedResume["education"] {
  const main = professionOf(byTime[0]![0]);
  const technical = Boolean(main.technicalEducation);
  const level: EducationLevel = technical
    ? "technical"
    : rng.weighted([
        ["incomplete-bachelor", 2],
        ["bachelor", 6],
        ["postgraduate", 3],
        ["master", 1],
      ] as const);
  const source = rng.chance(COURSE_FROM_MAIN_PROFESSION_CHANCE) ? main : professionOf(rng.pick(byTime)[0]);
  const course =
    !technical && rng.chance(UNRELATED_COURSE_CHANCE) ? rng.pick(UNRELATED_COURSES) : rng.pick(source.courses);
  // A graduação termina perto do primeiro emprego; pós e mestrado, em algum ano da carreira.
  const firstYear = getYear(career[0]!.start);
  const lastYear = getYear(career.at(-1)!.end ?? career.at(-1)!.start);

  const education: ExtractedResume["education"] = [
    {
      course,
      institution: rng.pick(technical ? TECHNICAL_SCHOOLS : UNIVERSITIES),
      level: level === "technical" || level === "incomplete-bachelor" ? level : "bachelor",
      completedIn: level === "incomplete-bachelor" ? null : firstYear - rng.int(0, 1),
    },
  ];
  if (level === "postgraduate")
    education.push({
      course: `${rng.pick(["MBA em", "Especialização em"])} ${rng.pick(POSTGRADUATE_TOPICS)}`,
      institution: rng.pick(UNIVERSITIES),
      level,
      completedIn: rng.int(firstYear + 1, Math.max(firstYear + 1, lastYear)),
    });
  if (level === "master")
    education.push({
      course: `Mestrado em ${rng.pick(source.courses)}`,
      institution: rng.pick(UNIVERSITIES),
      level,
      completedIn: rng.int(firstYear + 1, Math.max(firstYear + 1, lastYear)),
    });
  return education;
}

/**
 * Pessoa fictícia pelo Faker (em português, com a semente do conjunto). O e-mail fica sempre em
 * @example.com, domínio reservado para exemplo. Cidade e UF saem da lista do catálogo, porque o
 * Faker sorteia as duas separadas e daria "Recife, RS".
 */
function drawPerson(rng: Random, faker: Faker): ExtractedResume["personal"] {
  const sex = faker.person.sexType();
  const firstName = faker.person.firstName(sex);
  const lastName = faker.person.lastName();
  const [city, state] = rng.pick(CITIES);
  return {
    name: `${firstName} ${faker.person.lastName()} ${lastName}`,
    email: faker.internet.email({ firstName, lastName, provider: "example.com" }).toLowerCase(),
    phone: faker.phone.number(),
    city,
    state,
  };
}
