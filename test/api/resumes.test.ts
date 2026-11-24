import { describe, expect, spyOn, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createApp } from "@/api/app";
import { MAX_EXPERIENCES } from "@/api/features/resumes/consts";
import type { Database } from "@/db/client";
import { resumes } from "@/db/schema";
import type { ExtractedResume } from "@/domain/resume";
import { EXTRACTION_EXAMPLES } from "@/extraction/examples";
import { createProcessingService, MAX_ATTEMPTS, SAFE_ERRORS } from "@/resumes/processing";
import { methodById } from "@/similarity/methods";
import { useTestDatabase } from "../support/database";
import { buildResumes } from "../support/factories";
import { failingExtractor, fakeEmbeddings, fakeExtractor } from "../support/fakes";

/*
 * A API pelo HTTP (app.handle), no banco de teste e com a OpenAI substituída (test/support/fakes.ts).
 * O nome de cada teste diz a regra que ele prova. Rodar: bun run db:up && bun test test/api
 */

const db = useTestDatabase();
const app = createApp({ db, docs: true });
const worker = createProcessingService({ db, embeddings: fakeEmbeddings, extract: fakeExtractor });
const TOKEN = "token-de-teste-com-mais-de-16";

type Target = ReturnType<typeof createApp>;

async function call(
  method: string,
  path: string,
  body?: unknown,
  { target = app, headers = {} as Record<string, string> } = {},
) {
  const response = await target.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

/** Roda o worker até a fila esvaziar, como o laço de src/worker faria. */
async function drainQueue(processing = worker) {
  while ((await processing.processNext()).kind !== "idle");
}

/** Libera a espera entre tentativas, para o teste não precisar esperar. */
const skipRetryWait = () => db.update(resumes).set({ runAfter: sql`now()` });

const [backend, nursing, sales] = EXTRACTION_EXAMPLES.map((example) => example.expected) as [
  ExtractedResume,
  ExtractedResume,
  ExtractedResume,
];

describe("fila de processamento", () => {
  test("currículo estruturado entra como queued e o worker deixa ready, com o resumo montado das datas", async () => {
    const created = await call("POST", "/resumes", backend);
    expect(created).toEqual({ status: 202, body: { id: expect.stringMatching(/^res_/), status: "queued" } });

    await drainQueue();
    const { status, body } = await call("GET", `/resumes/${created.body.id}`);
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "ready", attempts: 1, error: null, data: backend });
    expect(body.summary).toContain("como desenvolvedor backend");
  });

  test("currículo em texto fica sem ficha até a extração; depois o worker preenche", async () => {
    const created = await call("POST", "/resumes/extract", { text: EXTRACTION_EXAMPLES[1]!.text });
    expect(created.status).toBe(202);
    expect((await call("GET", `/resumes/${created.body.id}`)).body).toMatchObject({
      status: "queued",
      data: null,
      summary: null,
    });

    await drainQueue();
    const { body } = await call("GET", `/resumes/${created.body.id}`);
    expect(body.status).toBe("ready");
    expect(body.data.headline).toBe(nursing.headline);
  });

  test(`falha mostra só a mensagem segura, vira failed na tentativa ${MAX_ATTEMPTS} e retry recoloca na fila`, async () => {
    const broken = createProcessingService({ db, embeddings: fakeEmbeddings, extract: failingExtractor });
    const created = await call("POST", "/resumes/extract", { text: EXTRACTION_EXAMPLES[0]!.text });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await broken.processNext();
      await skipRetryWait();
    }
    const failed = await call("GET", `/resumes/${created.body.id}`);
    expect(failed.body).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, error: SAFE_ERRORS.extraction });

    expect(await call("POST", `/resumes/${created.body.id}/retry`)).toEqual({
      status: 202,
      body: { id: created.body.id, status: "queued" },
    });
    await drainQueue();
    expect((await call("GET", `/resumes/${created.body.id}`)).body).toMatchObject({ status: "ready", attempts: 1 });
  });

  test("retry só aceita currículo que falhou (409 RESUME_NOT_FAILED)", async () => {
    const created = await call("POST", "/resumes", backend);
    const { status, body } = await call("POST", `/resumes/${created.body.id}/retry`);
    expect(status).toBe(409);
    expect(body.code).toBe("RESUME_NOT_FAILED");
  });

  test("dois retry ao mesmo tempo: um recoloca na fila, o outro recebe 409", async () => {
    const created = await call("POST", "/resumes", backend);
    await db.update(resumes).set({ status: "failed" });
    const statuses = (await Promise.all([1, 2].map(() => call("POST", `/resumes/${created.body.id}/retry`)))).map(
      (response) => response.status,
    );
    expect(statuses.toSorted()).toEqual([202, 409]);
  });

  test("retry de currículo que não existe responde 404", async () =>
    expect((await call("POST", "/resumes/res_missing/retry")).status).toBe(404));
});

describe("recomendação", () => {
  test("409 RESUME_NOT_READY enquanto o currículo não está pronto; 404 se nem existe", async () => {
    const created = await call("POST", "/resumes", backend);
    const { status, body } = await call("GET", `/resumes/${created.body.id}/similar`);
    expect(status).toBe(409);
    expect(body.code).toBe("RESUME_NOT_READY");
    expect((await call("GET", "/resumes/res_missing/similar")).status).toBe(404);
  });

  test("o currículo quase igual vem antes dos de outra profissão, em ordem de nota", async () => {
    // Mesmo perfil de backend com outra pessoa e outra empresa atual: deve ser o mais parecido.
    const twin: ExtractedResume = {
      ...backend,
      personal: { ...backend.personal, name: "Outra Pessoa", email: "outra@example.com" },
      experiences: backend.experiences.map((job, k) => (k === 0 ? { ...job, company: "Conta Fácil" } : job)),
    };
    const query = await call("POST", "/resumes", backend);
    const twinId = (await call("POST", "/resumes", twin)).body.id;
    for (const data of [nursing, sales]) await call("POST", "/resumes", data);
    await drainQueue();

    // minScore -1: o embedding falso não tem a escala do real, então a nota mínima calibrada não se aplica.
    const { status, body } = await call("GET", `/resumes/${query.body.id}/similar?top=3&minScore=-1`);
    expect(status).toBe(200);
    expect(body).toMatchObject({ method: "jobs-duration", minScore: -1 });
    expect(body.items).toHaveLength(3);
    expect(body.items[0]).toMatchObject({ id: twinId, headline: backend.headline });
    const scores = body.items.map((item: { score: number }) => item.score);
    expect(scores).toEqual(scores.toSorted((a: number, b: number) => b - a));
  });

  test("sem minScore, vale a nota mínima calibrada do método pedido", async () => {
    const query = await call("POST", "/resumes", backend);
    await call("POST", "/resumes", nursing);
    await drainQueue();
    for (const method of ["jobs-duration", "whole"] as const) {
      const { body } = await call("GET", `/resumes/${query.body.id}/similar?method=${method}`);
      expect(body.minScore).toBe(methodById(method).minScore);
    }
  });

  test("nota mínima corta quem não passa: a lista pode vir vazia", async () => {
    const query = await call("POST", "/resumes", backend);
    await call("POST", "/resumes", nursing);
    await drainQueue();
    const { body } = await call("GET", `/resumes/${query.body.id}/similar?minScore=0.999`);
    expect(body).toEqual({ method: "jobs-duration", minScore: 0.999, items: [] });
  });

  test("método que só ordena (RRF) ignora a nota mínima e devolve o top cheio", async () => {
    const [query] = await Promise.all(buildResumes(4).map((data) => call("POST", "/resumes", data)));
    await drainQueue();
    const { body } = await call("GET", `/resumes/${query!.body.id}/similar?method=sections-rrf&top=2&minScore=0.999`);
    expect(body).toMatchObject({ method: "sections-rrf", minScore: null });
    expect(body.items).toHaveLength(2);
  });
});

describe("leitura, lista e exclusão", () => {
  test("lista do mais novo para o mais antigo, em páginas pelo cursor", async () => {
    const ids: string[] = [];
    for (const data of [backend, nursing, sales]) ids.push((await call("POST", "/resumes", data)).body.id);

    const first = await call("GET", "/resumes?limit=2");
    expect(first.body.items.map((item: { id: string }) => item.id)).toEqual([ids[2], ids[1]]);
    expect(first.body.items[0]).toMatchObject({ status: "queued", headline: sales.headline, area: "sales" });
    const second = await call("GET", `/resumes?limit=2&cursor=${first.body.nextCursor}`);
    expect(second.body).toMatchObject({ items: [{ id: ids[0] }], nextCursor: null });
  });

  test("lista filtra por status e mostra null onde ainda não há ficha", async () => {
    await call("POST", "/resumes", backend);
    const text = await call("POST", "/resumes/extract", { text: EXTRACTION_EXAMPLES[2]!.text });
    const { body } = await call("GET", "/resumes?status=queued");
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({ id: text.body.id, headline: null, area: null, seniority: null });
    expect((await call("GET", "/resumes?status=ready")).body.items).toEqual([]);
    // Sem limite, a página tem o padrão: com 2 currículos, não há próxima.
    expect((await call("GET", "/resumes")).body.nextCursor).toBeNull();
  });

  test("DELETE apaga o currículo e todos os vetores dele (204, depois 404)", async () => {
    const created = await call("POST", "/resumes", backend);
    await drainQueue();
    expect((await call("DELETE", `/resumes/${created.body.id}`)).status).toBe(204);
    expect((await call("GET", `/resumes/${created.body.id}`)).status).toBe(404);
    const rows = await db.execute<{ count: number }>(
      sql`SELECT (SELECT count(*) FROM resume_vectors) + (SELECT count(*) FROM embedding_cache) AS count`,
    );
    expect(Number(rows[0]!.count)).toBe(0);
  });

  test("DELETE de currículo que não existe responde 404", async () =>
    expect((await call("DELETE", "/resumes/res_missing")).body.code).toBe("RESUME_NOT_FOUND"));
});

describe("acesso", () => {
  const secured = createApp({ db, docs: false, apiToken: TOKEN });

  test("com API_TOKEN, as rotas de currículo exigem o token: sem ele ou errado, 401", async () => {
    expect((await call("GET", "/resumes", undefined, { target: secured })).body.code).toBe("UNAUTHORIZED");
    const wrong = await call("GET", "/resumes", undefined, {
      target: secured,
      headers: { authorization: "Bearer errado" },
    });
    expect(wrong.status).toBe(401);
    const right = await call("GET", "/resumes", undefined, {
      target: secured,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(right.status).toBe(200);
  });

  test("sem token, corpo inválido recebe 401 e não 422: quem não tem acesso não vê o formato esperado", async () => {
    const { status } = await call("POST", "/resumes/extract", { text: "curto" }, { target: secured });
    expect(status).toBe(401);
  });

  test("/health continua aberto com token configurado", async () =>
    expect((await call("GET", "/health", undefined, { target: secured })).status).toBe(200));
});

describe("contrato e erros", () => {
  test("corpo inválido responde 422 VALIDATION_FAILED com a mensagem do schema por campo", async () => {
    const { status, body } = await call("POST", "/resumes/extract", { text: "curto" });
    expect(status).toBe(422);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fields.text).toContain("O currículo precisa ter pelo menos 50 caracteres.");
  });

  test("query inválida também responde 422, pelo nome do parâmetro", async () => {
    const { status, body } = await call("GET", "/resumes?limit=0");
    expect(status).toBe(422);
    expect(Object.keys(body.fields)).toContain("limit");
  });

  test(`currículo estruturado grande demais é recusado: mais de ${MAX_EXPERIENCES} empregos ou texto enorme`, async () => {
    const tooManyJobs = {
      ...backend,
      experiences: Array.from({ length: MAX_EXPERIENCES + 1 }, () => backend.experiences[0]!),
    };
    expect((await call("POST", "/resumes", tooManyJobs)).body.fields.experiences).toEqual([
      `O currículo pode ter no máximo ${MAX_EXPERIENCES} empregos.`,
    ]);
    const huge = { ...backend, skills: [..."x".repeat(60)].map((_, k) => `${"habilidade".repeat(100)} ${k}`) };
    expect((await call("POST", "/resumes", huge)).status).toBe(422);
  });

  test("JSON malformado responde 400 INVALID_JSON, não 500", async () => {
    const { status, body } = await call("POST", "/resumes/extract", "{isto não é json");
    expect(status).toBe(400);
    expect(body.code).toBe("INVALID_JSON");
  });

  test("currículo que não existe responde 404 RESUME_NOT_FOUND", async () => {
    const { status, body } = await call("GET", "/resumes/res_missing");
    expect(status).toBe(404);
    expect(body).toEqual({ error: "Currículo res_missing não encontrado.", code: "RESUME_NOT_FOUND" });
  });

  test("rota que não existe responde 404 ROUTE_NOT_FOUND", async () =>
    expect((await call("GET", "/nada")).body.code).toBe("ROUTE_NOT_FOUND"));

  test("ficha fora do formato no banco é defeito nosso: 500 sem mostrar o schema, não 422", async () => {
    // Uma ficha antiga gravada antes de o formato mudar (área que não existe mais).
    await db
      .insert(resumes)
      .values({ id: "res_old", data: { ...backend, area: "astrology" } as unknown as ExtractedResume });
    const silence = spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await call("GET", "/resumes/res_old");
    silence.mockRestore();
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Erro interno. Tente de novo em instantes.", code: "INTERNAL_ERROR" });
  });

  test("erro inesperado responde 500 INTERNAL_ERROR, sem vazar detalhe", async () => {
    // Banco quebrado de propósito: qualquer consulta lança.
    const broken = new Proxy(
      {},
      {
        get: () => () => {
          throw new Error("banco fora do ar");
        },
      },
    ) as unknown as Database;
    const silence = spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await call("GET", "/resumes", undefined, {
      target: createApp({ db: broken, docs: false }),
    });
    silence.mockRestore();
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Erro interno. Tente de novo em instantes.", code: "INTERNAL_ERROR" });
  });

  test("/health responde ok", async () =>
    expect(await call("GET", "/health")).toEqual({ status: 200, body: { status: "ok" } }));

  test("o OpenAPI documenta todas as rotas", async () => {
    const { status, body } = await call("GET", "/openapi/json");
    expect(status).toBe(200);
    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining([
        "/health",
        "/resumes",
        "/resumes/extract",
        "/resumes/{id}",
        "/resumes/{id}/similar",
        "/resumes/{id}/retry",
      ]),
    );
  });

  test("com docs desligado (produção) não há OpenAPI", async () => {
    const target: Target = createApp({ db, docs: false });
    expect((await call("GET", "/openapi/json", undefined, { target })).status).toBe(404);
  });
});
