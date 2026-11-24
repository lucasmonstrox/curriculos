/*
 * Limites e padrões das rotas de currículo, num lugar só: o service aplica e as descrições do OpenAPI
 * (dtos/) citam daqui, para a documentação nunca dizer um número e o código usar outro.
 */

/** Lista: quantos por página quando não dizem, e o máximo. */
export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;

/** Recomendação: o máximo de recomendados por pedido (o padrão é DEFAULT_TOP, de src/similarity). */
export const SIMILAR_MAX_TOP = 20;

/*
 * Busca em dois tempos: o índice HNSW pré-seleciona os CANDIDATE_POOL mais perto pela ficha inteira
 * (barato, aproximado) e a nota exata do método roda só sobre eles (cara: compara emprego a emprego).
 * 100 sobra para recomendar até 20. O pgvector aceita até 1000 (o teto do hnsw.ef_search).
 */
export const CANDIDATE_POOL = 100;

/*
 * Tamanho máximo de um currículo, em texto ou já estruturado: um corpo sem limite viraria milhares de
 * chamadas pagas de embedding. 50 mil caracteres cabem com folga um currículo de várias páginas.
 */
export const MAX_RESUME_CHARS = 50_000;
export const MAX_EXPERIENCES = 30;
