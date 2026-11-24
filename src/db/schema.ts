import { sql } from "drizzle-orm";
import {
  check,
  halfvec,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { ExtractedResume } from "../domain/resume";
import { SECTIONS } from "../domain/sections";
import { RESUME_STATUSES } from "../domain/status";
import { EMBEDDING_MODEL } from "../embedding/model";

/*
 * Três tabelas: o currículo, os vetores dele (um por seção e um por emprego) e o cache de embeddings
 * da linha de comando e do laboratório.
 *
 * A tabela de currículos é também a fila de processamento. Inserir um currículo não processa nada:
 * ele entra como `queued`, e o worker (src/worker) pega um por vez, extrai a ficha do texto (se veio
 * texto), gera os vetores e marca `ready`. Assim a API responde na hora e o trabalho lento (modelo de
 * linguagem e embedding) roda fora da requisição. As regras da fila estão em src/resumes.
 *
 * A ficha fica em jsonb, e não espalhada em colunas, porque ninguém consulta campo a campo: ela é
 * validada pelo Zod na entrada e lida inteira na saída.
 */

// Os estados e o que cada um quer dizer estão em src/domain/status.ts.
export const resumeStatus = pgEnum("resume_status", RESUME_STATUSES);

export const resumes = pgTable(
  "resumes",
  {
    // "res_" + UUID v7: o UUID v7 começa pelo tempo, então a ordem dos ids é a ordem de criação.
    id: text("id").primaryKey(),
    status: resumeStatus("status").notNull().default("queued"),
    // A ficha padronizada. Nula enquanto um currículo que chegou como texto não foi extraído.
    data: jsonb("data").$type<ExtractedResume>(),
    // O texto original, quando o currículo chegou como texto: é a entrada da extração e permite extrair
    // de novo com outro prompt. Tem dados pessoais: apagar o currículo apaga o texto junto.
    sourceText: text("source_text"),
    // Tentativas de processamento. Também serve de "token" da posse: só grava quem pegou com este número.
    attempts: integer("attempts").notNull().default(0),
    // Mensagem segura do último erro (o detalhe técnico só vai para o log do worker).
    lastError: text("last_error"),
    // Quando um worker pegou o currículo. Se o worker morrer no meio, outro retoma depois de um tempo.
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    // Não pegar antes desta hora: depois de uma falha, a próxima tentativa espera (limite de taxa passa).
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Sem ficha e sem texto não há o que processar.
    check("resumes_has_content", sql`${table.data} IS NOT NULL OR ${table.sourceText} IS NOT NULL`),
    // O worker procura o próximo da fila por status e ordem de chegada.
    index("resumes_queue").on(table.status, table.createdAt),
  ],
);

/** De que parte da ficha é o vetor: a ficha inteira, uma das seções (src/domain/sections) ou um emprego. */
export const VECTOR_KINDS = ["whole", ...SECTIONS, "job"] as const;
export const vectorKind = pgEnum("vector_kind", VECTOR_KINDS);

export const resumeVectors = pgTable(
  "resume_vectors",
  {
    resumeId: text("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    kind: vectorKind("kind").notNull(),
    // Para `job`, a posição do emprego no currículo (0 = o mais recente); para as seções, sempre 0.
    position: integer("position").notNull(),
    // halfvec (16 bits por número): o índice HNSW do pgvector aceita até 4000 dimensões nele, contra
    // 2000 no `vector`, e ocupa metade do espaço. Trocar o modelo de embedding exige gerar tudo de novo.
    embedding: halfvec("embedding", { dimensions: EMBEDDING_MODEL.dimensions }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.resumeId, table.kind, table.position] }),
    // Índice aproximado só nos vetores da ficha inteira: é por eles que a busca pré-seleciona os
    // candidatos antes da nota exata (src/resumes/repository.ts). A consulta precisa repetir o
    // `kind = 'whole'` literal para o planejador usar este índice parcial.
    index("resume_vectors_whole_hnsw")
      .using("hnsw", table.embedding.op("halfvec_cosine_ops"))
      .where(sql`kind = 'whole'`),
  ],
);

/**
 * Cache de embeddings da linha de comando e do laboratório (src/embedding/cache.ts), que geram os
 * mesmos textos muitas vezes: o vetor de cada texto, pelo hash de (modelo, texto). O worker não usa
 * este cache, para que apagar um currículo apague de fato todos os vetores dele.
 */
export const embeddingCache = pgTable("embedding_cache", {
  key: text("key").primaryKey(),
  embedding: halfvec("embedding", { dimensions: EMBEDDING_MODEL.dimensions }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ResumeRow = typeof resumes.$inferSelect;
export type ResumeVectorRow = typeof resumeVectors.$inferInsert;
