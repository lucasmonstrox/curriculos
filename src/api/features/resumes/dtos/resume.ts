import { z } from "zod";
import { extractedResumeSchema } from "@/domain/resume";
import { RESUME_STATUSES } from "@/domain/status";

/* O currículo como a API devolve, e o id nas rotas com `:id`. */

export const resumeParams = z.object({
  id: z.string().min(1).meta({ description: "Id do currículo (res_...)." }),
});

const status = z.enum(RESUME_STATUSES).meta({
  description:
    "queued: na fila. processing: sendo extraído ou gerando vetores. ready: pronto, entra nas recomendações. failed: falhou em todas as tentativas.",
});

export const resumeResponse = z
  .object({
    id: z.string(),
    status,
    data: extractedResumeSchema
      .nullable()
      .meta({ description: "A ficha padronizada; null enquanto um currículo enviado como texto não foi extraído." }),
    summary: z
      .string()
      .nullable()
      .meta({ description: "Resumo da carreira com o tempo em cada profissão, montado a partir das datas." }),
    attempts: z.number().int().meta({ description: "Quantas vezes o worker tentou processar." }),
    error: z.string().nullable().meta({
      description: "Em que passo a última tentativa falhou, quando falhou (o detalhe técnico fica no log do worker).",
    }),
    // Data com fuso (formatISO do date-fns): aceita "Z" e "-03:00".
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "Resume" });

/** Resposta de quem põe um currículo na fila: o id para acompanhar e o status inicial. */
export const queuedResponse = z
  .object({ id: z.string(), status })
  .meta({ id: "QueuedResume", description: "Currículo na fila; acompanhe pelo GET /resumes/{id}." });

export type ResumeResponse = z.infer<typeof resumeResponse>;
export type QueuedResponse = z.infer<typeof queuedResponse>;
