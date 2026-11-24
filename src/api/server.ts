import { connectDatabase } from "@/db/client";
import { readEnv } from "@/utils/env";
import { createApp } from "./app";

/* Entrada da API: `bun run api`. Só serve HTTP; quem processa a fila é o worker (`bun run worker`). */

const env = readEnv();
const production = env.NODE_ENV === "production";
// A API devolve dado pessoal: em produção, sem token, não sobe.
if (production && !env.API_TOKEN) throw new Error("Em produção, defina API_TOKEN no ambiente (veja o README).");
if (!env.API_TOKEN) console.warn("Sem API_TOKEN: as rotas de currículo estão abertas. Use só na sua máquina.");

const { db } = connectDatabase(env.DATABASE_URL);
const docs = !production;

createApp({ db, docs, apiToken: env.API_TOKEN }).listen({ port: env.PORT, hostname: env.HOST });
console.log(
  `API em http://${env.HOST}:${env.PORT}${docs ? ` · documentação em http://${env.HOST}:${env.PORT}/openapi` : ""}`,
);
