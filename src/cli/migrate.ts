import { connectDatabase } from "@/db/client";
import { migrateDatabase } from "@/db/migrate";
import { readEnv } from "@/utils/env";

/* `bun run db:migrate`: liga o pgvector e aplica as migrações no banco do DATABASE_URL. */

const { db, close } = connectDatabase(readEnv().DATABASE_URL);
await migrateDatabase(db);
await close();
console.log("Banco pronto: pgvector ligado e migrações aplicadas.");
