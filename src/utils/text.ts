/**
 * Texto em forma de identificador: sem acento, em minúsculas, palavras separadas por `separator`.
 * "Analista de Sucesso do Cliente" → "analista-de-sucesso-do-cliente".
 */
export function slugify(text: string, separator = "-"): string {
  return text
    .normalize("NFD") // separa cada acento da letra ("é" vira "e" + acento)
    .replace(/[̀-ͯ]/g, "") // e tira os acentos separados
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "");
}
