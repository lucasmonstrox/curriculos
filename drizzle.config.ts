import { defineConfig } from "drizzle-kit";
import { readEnv } from "./src/utils/env";

// O drizzle-kit gera as migrações a partir do schema; quem aplica é `bun run db:migrate`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: readEnv().DATABASE_URL },
});
