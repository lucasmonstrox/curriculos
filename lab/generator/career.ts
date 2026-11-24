import { subMonths } from "date-fns";
import type { Seniority } from "@/domain/resume";
import { seniorityByMonths } from "@/domain/seniority";
import { neighborsOf, PROFESSION_IDS, PROFESSIONS, type ProfessionId } from "./catalog/professions";
import type { Random } from "./random";

/*
 * Sorteio da carreira: quantos empregos, em quais profissões e em que datas.
 *
 * O teste só tem graça se os currículos não forem fáceis. Por isso a carreira mistura profissões:
 * às vezes vizinhas (backend e devops), às vezes nada a ver (vendas e backend), e às vezes vai e
 * volta entre elas. É esse tipo de currículo que separa um método bom de um ruim.
 */

/** Um emprego da carreira sorteada, antes de virar texto. */
export type CareerStep = { profession: ProfessionId; start: Date; end: Date | null; seniority: Seniority };

/*
 * Quantidade de empregos por currículo, com o peso de cada uma: metade dos currículos com 6 ou 7
 * empregos (os longos, onde o vetor único da experiência mais erra), o resto de 2 a 5.
 */
const JOB_COUNTS: readonly (readonly [number, number])[] = [
  [2, 12],
  [3, 12],
  [4, 13],
  [5, 13],
  [6, 25],
  [7, 25],
];

/*
 * Formato da carreira, com o peso de cada um: um pouco mais da metade numa profissão só; o resto
 * passa por duas (vizinhas ou não) ou por três.
 */
type CareerPattern = "single" | "two-neighbors" | "two-unrelated" | "three";
const PATTERNS: readonly (readonly [CareerPattern, number])[] = [
  ["single", 55],
  ["two-neighbors", 15],
  ["two-unrelated", 15],
  ["three", 15],
];

// Duração de cada emprego (meses) e intervalo entre um emprego e o seguinte (meses sem trabalhar).
const JOB_MONTHS = { min: 6, max: 40 } as const;
const GAP_MONTHS = { min: 0, max: 4 } as const;
// Chance de a pessoa estar empregada hoje; quem não está saiu do último emprego há 1 a 8 meses.
const EMPLOYED_CHANCE = 0.8;
const UNEMPLOYED_MONTHS = { min: 1, max: 8 } as const;
// Quem vai e volta entre profissões: em vez de blocos seguidos, a ordem dos empregos é embaralhada.
const BACK_AND_FORTH_CHANCE = 0.25;

/** Sorteia uma profissão pelo peso do catálogo, fora das que estão em `excluded`. */
export function drawProfession(rng: Random, excluded: readonly ProfessionId[] = []): ProfessionId {
  return rng.weighted(PROFESSION_IDS.filter((id) => !excluded.includes(id)).map((id) => [id, PROFESSIONS[id].weight]));
}

/** A profissão de cada emprego, do mais antigo para o mais recente. */
function drawProfessionSequence(rng: Random, count: number): ProfessionId[] {
  const main = drawProfession(rng);
  let pattern = rng.weighted(PATTERNS);
  // Três profissões precisam de pelo menos três empregos.
  if (pattern === "three" && count < 3) pattern = "two-unrelated";
  if (pattern === "single" || count < 2) return Array<ProfessionId>(count).fill(main);

  // A segunda profissão: uma vizinha da principal, ou uma que não é vizinha nem a própria.
  const neighbors = neighborsOf(main);
  const second =
    pattern === "two-neighbors" && neighbors.length ? rng.pick(neighbors) : drawProfession(rng, [main, ...neighbors]);

  // A principal fica com a maioria dos empregos; a segunda com até a metade; a terceira com um só.
  const blocks: [ProfessionId, number][] = [];
  if (pattern === "three") {
    const third = drawProfession(rng, [main, second]);
    const secondCount = rng.int(1, Math.max(1, Math.floor((count - 1) / 2)));
    blocks.push([second, secondCount], [third, 1], [main, count - secondCount - 1]);
  } else {
    const secondCount = rng.int(1, Math.max(1, Math.floor(count / 2)));
    blocks.push([second, secondCount], [main, count - secondCount]);
  }

  // Em geral a carreira anda em blocos (trocou de profissão e ficou); às vezes vai e volta.
  const sequence = rng.shuffle(blocks).flatMap(([profession, n]) => Array<ProfessionId>(n).fill(profession));
  return rng.chance(BACK_AND_FORTH_CHANCE) ? rng.shuffle(sequence) : sequence;
}

/**
 * Nível pelo tempo acumulado na profissão até o fim daquele emprego, com a mesma régua do prompt de
 * extração (src/domain/seniority). Duas exceções sorteadas: o primeiro emprego da vida, curto, às
 * vezes é estágio; sênior e especialista às vezes viram liderança de time.
 */
function seniorityFor(rng: Random, monthsInProfession: number, firstJob: boolean): Seniority {
  if (firstJob && monthsInProfession < 12 && rng.chance(0.4)) return "intern";
  const level = seniorityByMonths(monthsInProfession);
  return (level === "senior" || level === "specialist") && rng.chance(0.2) ? "lead" : level;
}

/** A carreira inteira, do emprego mais antigo para o mais recente, com datas e nível de cada um. */
export function drawCareer(rng: Random, reference: Date): CareerStep[] {
  const professions = drawProfessionSequence(rng, rng.weighted(JOB_COUNTS));
  const durations = professions.map(() => rng.int(JOB_MONTHS.min, JOB_MONTHS.max));
  const employed = rng.chance(EMPLOYED_CHANCE);

  // As datas são montadas de trás para frente, a partir de hoje: o último emprego termina agora (ou
  // há alguns meses, se a pessoa está sem emprego), e cada anterior termina um pouco antes do seguinte.
  const periods: { start: Date; end: Date | null }[] = [];
  let cursor = employed ? reference : subMonths(reference, rng.int(UNEMPLOYED_MONTHS.min, UNEMPLOYED_MONTHS.max));
  for (let k = professions.length - 1; k >= 0; k--) {
    const start = subMonths(cursor, durations[k]!);
    periods[k] = { start, end: k === professions.length - 1 && employed ? null : cursor };
    cursor = subMonths(start, rng.int(GAP_MONTHS.min, GAP_MONTHS.max));
  }

  // O nível sobe com o tempo acumulado em cada profissão: quem troca de profissão recomeça de baixo.
  const monthsSoFar = new Map<ProfessionId, number>();
  return professions.map((profession, k) => {
    const months = (monthsSoFar.get(profession) ?? 0) + durations[k]!;
    monthsSoFar.set(profession, months);
    return { profession, ...periods[k]!, seniority: seniorityFor(rng, months, k === 0) };
  });
}
