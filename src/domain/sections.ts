/**
 * As seções da ficha que viram vetor, cada uma com o seu. Num lugar só porque a ficha (src/profile),
 * os métodos de semelhança (src/similarity) e a tabela de vetores (src/db) precisam da mesma lista.
 */
export const SECTIONS = ["profile", "skills", "experience", "education"] as const;

export type Section = (typeof SECTIONS)[number];
