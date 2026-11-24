/*
 * Estados de um currículo na fila de processamento (a tabela de currículos é a fila, ver
 * src/db/schema.ts):
 *   queued      esperando o worker;
 *   processing  um worker pegou e está extraindo ou gerando os vetores;
 *   ready       ficha e vetores prontos: entra nas recomendações;
 *   failed      falhou em todas as tentativas; o erro fica guardado e dá para tentar de novo.
 */
export const RESUME_STATUSES = ["queued", "processing", "ready", "failed"] as const;

export type ResumeStatus = (typeof RESUME_STATUSES)[number];
