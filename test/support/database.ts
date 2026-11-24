import { afterAll, beforeAll, beforeEach } from "bun:test";
import { sql } from "drizzle-orm";
import { connectDatabase } from "@/db/client";
import { migrateDatabase } from "@/db/migrate";
import { readEnv } from "@/utils/env";

/*
 * Banco de teste (resumes_test, criado pelo docker/init.sql): cada arquivo de teste abre a própria
 * conexão, aplica as migrações uma vez, começa cada teste com as tabelas vazias e fecha no fim.
 *
 * Os `await` explícitos importam: a consulta do Drizzle só roda quando aguardada, e o Bun não aguarda
 * um "thenable" devolvido pelo gancho.
 */
export function useTestDatabase() {
  const { db, close } = connectDatabase(readEnv().TEST_DATABASE_URL);
  beforeAll(async () => {
    await migrateDatabase(db);
  });
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE resumes, embedding_cache CASCADE`);
  });
  afterAll(async () => {
    await close();
  });
  return db;
}
