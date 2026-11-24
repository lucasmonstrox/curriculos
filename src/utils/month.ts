import { differenceInCalendarMonths, format, isValid, parse, startOfMonth } from "date-fns";

/*
 * Meses no formato AAAA-MM, a precisão que um currículo costuma ter. Internamente cada mês é a Date
 * do dia 1, e toda conta passa pelo date-fns (nada de aritmética manual de datas).
 */

const MONTH_FORMAT = "yyyy-MM";

/** Formato de mês aceito em todo o projeto: AAAA-MM (ex.: 2024-03). Usado também nos schemas. */
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseMonth(value: string): Date {
  // O `parse` do date-fns aceita "2024-3"; a expressão regular garante os dois dígitos do mês.
  const date = parse(value, MONTH_FORMAT, new Date(2000, 0, 1));
  if (!MONTH_PATTERN.test(value) || !isValid(date)) throw new Error(`Mês inválido: "${value}" (esperado AAAA-MM)`);
  return date;
}

export const formatMonth = (date: Date): string => format(date, MONTH_FORMAT);

/** Meses de calendário entre dois meses: de 2024-01 a 2024-04 são 3. */
export const monthsBetween = (start: Date, end: Date): number => differenceInCalendarMonths(end, start);

/**
 * O "agora" dos currículos reais: o dia 1 do mês corrente. O emprego atual conta até aqui nas contas
 * de duração e recência (o conjunto sintético usa um mês fixo no lugar).
 */
export const currentMonthStart = (): Date => startOfMonth(new Date());

/** O mês corrente em AAAA-MM. */
export const currentMonth = (): string => formatMonth(currentMonthStart());
