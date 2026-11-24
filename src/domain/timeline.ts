import { compareAsc, isAfter, max } from "date-fns";
import { monthsBetween, parseMonth } from "../utils/month";
import type { Experience } from "./resume";

/*
 * Contas de tempo sobre os empregos. Ficam num lugar só porque o gerador (gabarito), a ficha (peso
 * de cada emprego) e as páginas de exemplo precisam dar o mesmo número para o mesmo emprego.
 */

/** Começo e fim do emprego; o emprego atual (`end: null`) vai até o mês de referência. */
export function experienceSpan(experience: Experience, reference: Date): { start: Date; end: Date } {
  return {
    start: parseMonth(experience.start),
    end: experience.end === null ? reference : parseMonth(experience.end),
  };
}

/** Duração em meses, com mínimo de 1: um emprego que começa e acaba no mesmo mês ainda conta. */
export function experienceMonths(experience: Experience, reference: Date): number {
  const { start, end } = experienceSpan(experience, reference);
  return Math.max(1, monthsBetween(start, end));
}

/**
 * Meses de carreira, sem contar duas vezes os empregos ao mesmo tempo: dois empregos de 2020 a 2022
 * são 2 anos de carreira, não 4.
 */
export function careerMonths(experiences: readonly Experience[], reference: Date): number {
  const spans = experiences.map((e) => experienceSpan(e, reference)).sort((a, b) => compareAsc(a.start, b.start));
  let total = 0;
  let coveredUntil: Date | null = null;
  for (const { start, end } of spans) {
    // Só soma o trecho que ainda não foi coberto por um emprego anterior.
    const from = coveredUntil ? max([start, coveredUntil]) : start;
    if (isAfter(end, from)) total += monthsBetween(from, end);
    coveredUntil = coveredUntil ? max([coveredUntil, end]) : end;
  }
  return Math.max(1, total);
}
