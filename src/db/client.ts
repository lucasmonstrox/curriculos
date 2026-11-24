import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/* Conexão com o Postgres. Quem abre fecha: `close` encerra o pool no fim do comando ou do teste. */

export function connectDatabase(url: string) {
  const client = postgres(url, {
    max: 10,
    // O Postgres só manda aviso a partir de WARNING. Os NOTICE são informativos ("já existe" nas
    // migrações, "truncate cascades" nos testes) e só sujariam o log.
    connection: { client_min_messages: "warning" },
  });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

export type Database = ReturnType<typeof connectDatabase>["db"];
