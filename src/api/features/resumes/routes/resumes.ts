import { Elysia } from "elysia";
import { errorResponse } from "@/api/errors";
import { createResumeBody, extractResumeBody } from "../dtos/create-resume";
import { listResumesQuery, listResumesResponse } from "../dtos/list-resumes";
import { queuedResponse, resumeParams, resumeResponse } from "../dtos/resume";
import { similarResumesQuery, similarResumesResponse } from "../dtos/similar-resumes";
import type { ResumesService } from "../services/resumes";

/*
 * As rotas de currículo. Só falam HTTP: caminho, schema de entrada e de saída de cada status e a
 * documentação do OpenAPI. A regra está no service.
 */

const TAGS = ["Currículos"];

export function resumesRoutes(service: ResumesService) {
  return new Elysia({ prefix: "/resumes" })
    .post("", async ({ body, status }) => status(202, await service.enqueueData(body)), {
      body: createResumeBody,
      response: { 202: queuedResponse, 422: errorResponse },
      detail: {
        tags: TAGS,
        summary: "Enviar um currículo já estruturado",
        description:
          "Para quem já tem a ficha padronizada (o mesmo formato que a extração devolve). O currículo entra na fila com status `queued`; o worker gera os vetores e ele passa a `ready`.",
      },
    })
    .post("/extract", async ({ body, status }) => status(202, await service.enqueueText(body.text)), {
      body: extractResumeBody,
      response: { 202: queuedResponse, 422: errorResponse },
      detail: {
        tags: TAGS,
        summary: "Enviar um currículo em texto",
        description:
          "O currículo como veio, em texto livre. Entra na fila com status `queued`; o worker lê com o modelo de linguagem, monta a ficha padronizada, gera os vetores e ele passa a `ready`. Acompanhe pelo GET /resumes/{id}.",
      },
    })
    .get("", ({ query }) => service.list(query), {
      query: listResumesQuery,
      response: { 200: listResumesResponse, 422: errorResponse },
      detail: { tags: TAGS, summary: "Listar currículos", description: "Do mais novo para o mais antigo, em páginas." },
    })
    .get("/:id", ({ params }) => service.get(params.id), {
      params: resumeParams,
      response: { 200: resumeResponse, 404: errorResponse },
      detail: {
        tags: TAGS,
        summary: "Ver um currículo",
        description: "A ficha, o resumo da carreira e o status na fila.",
      },
    })
    .get("/:id/similar", ({ params, query }) => service.similar(params.id, query), {
      params: resumeParams,
      query: similarResumesQuery,
      response: { 200: similarResumesResponse, 404: errorResponse, 409: errorResponse, 422: errorResponse },
      detail: {
        tags: TAGS,
        summary: "Currículos mais parecidos",
        description:
          "Compara o currículo com os outros currículos prontos e devolve os mais parecidos, do mais para o menos. Só aparece quem passa da nota mínima: a lista pode vir vazia quando ninguém é parecido. Responde 409 se o currículo ainda não está pronto.",
      },
    })
    .post("/:id/retry", async ({ params, status }) => status(202, await service.retry(params.id)), {
      params: resumeParams,
      response: { 202: queuedResponse, 404: errorResponse, 409: errorResponse },
      detail: {
        tags: TAGS,
        summary: "Tentar de novo um currículo que falhou",
        description: "Põe de volta na fila um currículo com status `failed`, zerando as tentativas.",
      },
    })
    .delete(
      "/:id",
      // 204 sem corpo: o `set.status` direto, porque um schema de "corpo vazio" não vira JSON Schema.
      async ({ params, set }) => {
        await service.remove(params.id);
        set.status = 204;
      },
      {
        params: resumeParams,
        response: { 404: errorResponse },
        detail: {
          tags: TAGS,
          summary: "Apagar um currículo",
          description: "Apaga o currículo, o texto original e os vetores. Não dá para desfazer.",
        },
      },
    );
}
