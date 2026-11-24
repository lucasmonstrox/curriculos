/* Estatística mínima. Lista vazia dá NaN de propósito: quem chama decide o que mostrar. */

export const sum = (values: readonly number[]): number => values.reduce((total, x) => total + x, 0);

export const mean = (values: readonly number[]): number => sum(values) / values.length;

/** Desvio padrão populacional (divide por n): descreve as notas que existem, não estima outras. */
export function deviation(values: readonly number[]): number {
  const average = mean(values);
  return Math.sqrt(mean(values.map((x) => (x - average) ** 2)));
}
