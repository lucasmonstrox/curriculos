import { EMBEDDING_MODEL } from "@/embedding";
import type { EmbeddingProvider } from "@/embedding/provider";
import { EXTRACTION_EXAMPLES } from "@/extraction/examples";
import type { Extractor } from "@/extraction/extract";

/*
 * Substitutos da OpenAI para os testes: determinísticos, sem rede e sem custo.
 *
 * O embedding falso é um "saco de palavras": cada palavra soma 1 numa dimensão escolhida pelo hash
 * dela. Textos com palavras em comum ficam parecidos, o que basta para testar a ordem da recomendação.
 */

/** FNV-1a de 32 bits: hash rápido e estável para espalhar as palavras pelas dimensões. */
function hash(word: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < word.length; i++) h = Math.imul(h ^ word.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

function bagOfWords(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_MODEL.dimensions).fill(0);
  vector[0] = 1; // nunca nulo, mesmo num texto sem palavras
  for (const word of text.toLowerCase().match(/\p{L}+/gu) ?? []) vector[1 + (hash(word) % (vector.length - 1))]! += 1;
  return vector;
}

export const fakeEmbeddings: EmbeddingProvider = {
  id: "fake/bag-of-words",
  embed: async (texts) => texts.map(bagOfWords),
};

/** Devolve a ficha esperada de um dos exemplos do prompt, pelo texto; qualquer outro texto falha. */
export const fakeExtractor: Extractor = async (text) => {
  const example = EXTRACTION_EXAMPLES.find((e) => e.text.trim() === text.trim());
  if (!example) throw new Error("Extrator falso: texto fora dos exemplos.");
  return example.expected;
};

export const failingExtractor: Extractor = async () => {
  throw new Error("Modelo fora do ar (simulado).");
};
