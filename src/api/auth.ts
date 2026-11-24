import { timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import { AppError } from "./errors";

/*
 * Acesso por token: com API_TOKEN configurado, toda rota de currículo exige o cabeçalho
 * `Authorization: Bearer <token>`. A API devolve dado pessoal (nome, contato, pretensão), então em
 * produção o servidor nem sobe sem token (src/api/server.ts). /health e a documentação ficam abertas.
 *
 * A checagem roda em `onRequest`, antes de ler o corpo: quem não tem acesso recebe 401, nunca um 422
 * que revelaria o formato esperado.
 */

const PROTECTED_PREFIX = "/resumes";

/** Comparação em tempo constante: não deixa descobrir o token medindo quanto a resposta demora. */
function sameToken(received: string, expected: string): boolean {
  const [a, b] = [Buffer.from(received), Buffer.from(expected)];
  return a.length === b.length && timingSafeEqual(a, b);
}

export const bearerAuth = (token: string | undefined) =>
  new Elysia({ name: "bearer-auth" }).onRequest(({ request }) => {
    if (!token || !new URL(request.url).pathname.startsWith(PROTECTED_PREFIX)) return;
    const header = request.headers.get("authorization") ?? "";
    if (!header.startsWith("Bearer ") || !sameToken(header.slice("Bearer ".length), token))
      throw new AppError("UNAUTHORIZED");
  });
