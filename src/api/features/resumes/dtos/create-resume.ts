import { z } from "zod";
import { extractedResumeSchema } from "@/domain/resume";
import { MAX_EXPERIENCES, MAX_RESUME_CHARS } from "../consts";

const formatLimit = (value: number) => value.toLocaleString("pt-BR");

/**
 * Currículo já estruturado (a ficha pronta): entra na fila só para gerar os vetores. Os limites de
 * tamanho ficam aqui, na rota, e não no schema da ficha: aquele schema também vai para o modelo de
 * linguagem, que não precisa saber de limite de custo.
 */
export const createResumeBody = extractedResumeSchema
  .superRefine((resume, ctx) => {
    if (resume.experiences.length > MAX_EXPERIENCES)
      ctx.addIssue({
        code: "custom",
        path: ["experiences"],
        message: `O currículo pode ter no máximo ${MAX_EXPERIENCES} empregos.`,
      });
    if (JSON.stringify(resume).length > MAX_RESUME_CHARS)
      ctx.addIssue({
        code: "custom",
        path: [],
        message: `O currículo pode ter no máximo ${formatLimit(MAX_RESUME_CHARS)} caracteres.`,
      });
  })
  .meta({ id: "ResumeData" });

/** Currículo em texto livre: entra na fila para ser lido pelo modelo de linguagem e depois gerar os vetores. */
export const extractResumeBody = z
  .object({
    text: z
      .string()
      .min(50, "O currículo precisa ter pelo menos 50 caracteres.")
      .max(MAX_RESUME_CHARS, `O currículo pode ter no máximo ${formatLimit(MAX_RESUME_CHARS)} caracteres.`)
      .meta({ description: "O texto do currículo, como veio (colado de um PDF, de um formulário...)." }),
  })
  .meta({ id: "ResumeText" });

export type CreateResumeBody = z.infer<typeof createResumeBody>;
export type ExtractResumeBody = z.infer<typeof extractResumeBody>;
