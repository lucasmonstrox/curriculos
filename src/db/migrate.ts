import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Database } from "./client";

/** Pasta das migrações geradas pelo drizzle-kit (`bun run db:generate`), achada a partir deste arquivo. */
const MIGRATIONS_FOLDER = fileURLToPath(new URL("./migrations", import.meta.url));

/**
 * Deixa o banco pronto: liga o pgvector e aplica as migrações. A extensão vem antes porque as tabelas
 * de vetores usam o tipo `halfvec`, que só existe com ela, e o drizzle-kit não cria extensões.
 */
export async function migrateDatabase(db: Database): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
