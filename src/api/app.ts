import { openapi } from "@elysiajs/openapi";
import { Elysia, ValidationError } from "elysia";
import { z } from "zod";
import type { Database } from "@/db/client";
import { bearerAuth } from "./auth";
import { AppError, type ErrorCode, ERRORS, type ErrorResponse } from "./errors";
import { resumesFeature } from "./features/resumes";

/*
 * O app da API: monta o acesso, as features, a documentação e o tratamento de erros. Recebe as
 * dependências em vez de criá-las, para os testes passarem um banco de teste e um token.
 */

export type AppDependencies = {
  db: Database;
  /** Liga a página do OpenAPI em /openapi (fora de produção). */
  docs: boolean;
  /** Com token, as rotas de currículo exigem `Authorization: Bearer <token>` (src/api/auth.ts). */
  apiToken?: string;
};

const healthResponse = z.object({ status: z.literal("ok") });

/** O corpo de erro de um código, com a mensagem padrão dele (src/api/errors.ts). */
const errorBody = (code: ErrorCode): ErrorResponse => ({ error: ERRORS[code].message, code });

export function createApp({ db, docs, apiToken }: AppDependencies) {
  return (
    new Elysia()
      // Um tratamento de erro só, aqui no app raiz: o service lança, este traduz para o corpo
      // `{ error, code, fields? }` com o status certo. Registrado antes dos plugins para valer neles.
      .onError(({ code, error, set }): ErrorResponse => {
        if (error instanceof AppError) {
          set.status = error.status;
          return { error: error.message, code: error.code };
        }
        // Erro na validação da *resposta* é defeito nosso (uma ficha antiga fora do formato no banco,
        // por exemplo), não do cliente: vai para o log e vira 500, sem mostrar o schema interno.
        if (error instanceof ValidationError && error.type !== "response") {
          set.status = ERRORS.VALIDATION_FAILED.status;
          return { ...errorBody("VALIDATION_FAILED"), fields: fieldsOf(error) };
        }
        if (code === "PARSE") {
          set.status = ERRORS.INVALID_JSON.status;
          return errorBody("INVALID_JSON");
        }
        if (code === "NOT_FOUND") {
          set.status = ERRORS.ROUTE_NOT_FOUND.status;
          return errorBody("ROUTE_NOT_FOUND");
        }
        console.error(error);
        set.status = ERRORS.INTERNAL_ERROR.status;
        return errorBody("INTERNAL_ERROR");
      })
      .use(
        openapi({
          enabled: docs,
          // As rotas validam com Zod; o OpenAPI sai do mesmo schema, convertido pelo próprio Zod.
          mapJsonSchema: { zod: z.toJSONSchema },
          documentation: {
            info: {
              title: "curriculos",
              version: "0.1.0",
              description:
                "Recebe currículos (em texto ou já estruturados), padroniza com um modelo de linguagem, gera vetores e recomenda os currículos mais parecidos com cada um.",
            },
            tags: [
              { name: "Currículos", description: "Envio, fila de processamento e recomendação." },
              { name: "Sistema", description: "Saúde da API." },
            ],
            components: {
              securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "O API_TOKEN do servidor." } },
            },
          },
        }),
      )
      .use(bearerAuth(apiToken))
      .get("/health", () => ({ status: "ok" as const }), {
        response: { 200: healthResponse },
        detail: { tags: ["Sistema"], summary: "Saúde da API", description: "Responde ok quando a API está no ar." },
      })
      .use(resumesFeature({ db }))
  );
}

/**
 * As mensagens de validação por campo, pelo caminho do campo ("experiences.0.start"). O Elysia
 * entrega os problemas do Zod em `error.all`, com o caminho em forma de ponteiro JSON
 * ("/experiences/0/start") e a mensagem do schema. Sem caminho (o corpo inteiro), a chave é a parte:
 * "body", "query".
 */
function fieldsOf(error: ValidationError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.all as { path?: string; message?: string; summary?: string }[]) {
    const path = (issue.path ?? "").replace(/^\//, "").replaceAll("/", ".");
    (fields[path || error.type] ??= []).push(issue.message ?? issue.summary ?? ERRORS.VALIDATION_FAILED.message);
  }
  return fields;
}

export type App = ReturnType<typeof createApp>;
