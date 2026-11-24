import { z } from "zod";

/*
 * Variáveis de ambiente, num lugar só. O Bun lê o arquivo .env da raiz sozinho; aqui só se valida.
 * Só a chave da OpenAI é obrigatória, e só para quem fala com a OpenAI (embedding e extração): os
 * testes e os comandos locais rodam sem ela.
 */

/** O banco do docker-compose.yml. Não é segredo: só existe na máquina de quem roda. */
export const LOCAL_DATABASE_URL = "postgres://postgres:postgres@localhost:54370/resumes";
export const LOCAL_TEST_DATABASE_URL = "postgres://postgres:postgres@localhost:54370/resumes_test";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  EXTRACTION_MODEL: z.string().min(1).optional(),
  DATABASE_URL: z.url().default(LOCAL_DATABASE_URL),
  TEST_DATABASE_URL: z.url().default(LOCAL_TEST_DATABASE_URL),
  // Token das rotas de currículo (src/api/auth.ts). Obrigatório em produção; vazio, a API fica aberta.
  API_TOKEN: z.string().min(16, "API_TOKEN precisa ter pelo menos 16 caracteres.").optional(),
  // Só a própria máquina por padrão; num contêiner ou servidor, 0.0.0.0 para aceitar conexões de fora.
  HOST: z.string().min(1).default("localhost"),
  PORT: z.coerce.number().int().positive().default(3000),
  // Em produção a documentação do OpenAPI desliga e o API_TOKEN vira obrigatório.
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

export const readEnv = (): Env => envSchema.parse(process.env);

export function openAIKeyFromEnv(): string {
  const { OPENAI_API_KEY } = readEnv();
  if (!OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY no .env (veja a seção Configuração do README).");
  return OPENAI_API_KEY;
}
