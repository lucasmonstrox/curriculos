import { afterEach, expect, test } from "bun:test";
import { LOCAL_DATABASE_URL, LOCAL_TEST_DATABASE_URL, openAIKeyFromEnv, readEnv } from "./env";

/* As variáveis de ambiente com os padrões do código, sem depender do .env da máquina que roda o teste. */

const saved = { ...process.env };
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
});

test("sem a chave da OpenAI, para com a instrução de onde configurar", () => {
  delete process.env.OPENAI_API_KEY;
  expect(() => openAIKeyFromEnv()).toThrow(/OPENAI_API_KEY/);
});

test("com a chave, devolve a chave", () => {
  process.env.OPENAI_API_KEY = "chave-de-teste";
  expect(openAIKeyFromEnv()).toBe("chave-de-teste");
});

test("sem nada no ambiente, valem os padrões: banco do docker-compose, só a própria máquina, desenvolvimento", () => {
  for (const key of ["DATABASE_URL", "TEST_DATABASE_URL", "HOST", "PORT", "NODE_ENV", "API_TOKEN"])
    delete process.env[key];
  expect(readEnv()).toMatchObject({
    DATABASE_URL: LOCAL_DATABASE_URL,
    TEST_DATABASE_URL: LOCAL_TEST_DATABASE_URL,
    HOST: "localhost",
    PORT: 3000,
    NODE_ENV: "development",
  });
  expect(readEnv().API_TOKEN).toBeUndefined();
});

test("token curto é recusado", () => {
  process.env.API_TOKEN = "curto";
  expect(() => readEnv()).toThrow(/16 caracteres/);
});
