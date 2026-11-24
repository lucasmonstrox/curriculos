/*
 * O modelo de embedding do projeto. Fica num arquivo próprio, sem dependências, porque o schema do
 * banco precisa das dimensões (coluna halfvec) e o banco não pode depender do resto do embedding.
 *
 * O text-embedding-3-large tem 3072 dimensões e aceita ser cortado (Matryoshka); em 2048 quase não
 * perde. No pgvector, o índice HNSW no tipo `vector` vai até 2000 dimensões, por isso o banco guarda
 * em `halfvec` (até 4000). Trocar de modelo ou de dimensão pede gerar todos os vetores de novo.
 */
export const EMBEDDING_MODEL = { model: "text-embedding-3-large", dimensions: 2048 } as const;
