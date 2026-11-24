import type { Seniority } from "./resume";

/*
 * Régua de nível pelo tempo na profissão atual, quando o cargo não diz o nível. É a mesma régua no
 * gerador sintético e no prompt de extração (que a escreve a partir daqui), para os dois concordarem.
 */
export const SENIORITY_BY_MONTHS: readonly { readonly below: number; readonly level: Seniority }[] = [
  { below: 24, level: "junior" }, // menos de 2 anos
  { below: 60, level: "mid" }, // de 2 a 5 anos
  { below: 120, level: "senior" }, // de 5 a 10 anos
  { below: Infinity, level: "specialist" }, // 10 anos ou mais
];

export const seniorityByMonths = (months: number): Seniority =>
  SENIORITY_BY_MONTHS.find(({ below }) => months < below)!.level;
