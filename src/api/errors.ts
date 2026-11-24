import { z } from "zod";

/*
 * Erros da API, num lugar só: o código estável (em inglês, para quem chama decidir o que fazer), o
 * status HTTP e a mensagem padrão (em português, para mostrar a uma pessoa). O service lança um
 * AppError e um único `onError`, no app raiz (src/api/app.ts), traduz para `{ error, code, fields? }`.
 */
export const ERRORS = {
  INVALID_JSON: { status: 400, message: "O corpo da requisição não é um JSON válido." },
  UNAUTHORIZED: { status: 401, message: "Falta o token de acesso, ou ele não confere." },
  ROUTE_NOT_FOUND: { status: 404, message: "Rota não encontrada." },
  RESUME_NOT_FOUND: { status: 404, message: "Currículo não encontrado." },
  RESUME_NOT_READY: { status: 409, message: "O currículo ainda não está pronto." },
  RESUME_NOT_FAILED: { status: 409, message: "Só dá para tentar de novo um currículo que falhou." },
  VALIDATION_FAILED: { status: 422, message: "Dados inválidos." },
  INTERNAL_ERROR: { status: 500, message: "Erro interno. Tente de novo em instantes." },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorCode = keyof typeof ERRORS;
export const ERROR_CODES = Object.keys(ERRORS) as [ErrorCode, ...ErrorCode[]];

export class AppError extends Error {
  readonly status: number;
  /** `message` troca a mensagem padrão por uma mais específica (com o id do currículo, por exemplo). */
  constructor(
    readonly code: ErrorCode,
    message: string = ERRORS[code].message,
  ) {
    super(message);
    this.status = ERRORS[code].status;
  }
}

/** O corpo de toda resposta de erro. `fields` só vem nos erros de validação: mensagens por campo. */
export const errorResponse = z
  .object({
    error: z.string().meta({ description: "Mensagem para mostrar a uma pessoa." }),
    code: z.enum(ERROR_CODES).meta({ description: "Código estável do erro." }),
    fields: z
      .record(z.string(), z.array(z.string()))
      .optional()
      .meta({ description: "Só em VALIDATION_FAILED: as mensagens de cada campo inválido, pelo caminho do campo." }),
  })
  .meta({ id: "Error" });

export type ErrorResponse = z.infer<typeof errorResponse>;
