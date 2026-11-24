import { z } from "zod";
import { AREAS, SENIORITIES } from "@/domain/resume";
import { RESUME_STATUSES } from "@/domain/status";
import { LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT } from "../consts";

/*
 * Lista de currículos, do mais novo para o mais antigo, em páginas. A página seguinte começa depois
 * do `nextCursor` da anterior. Sem `.default()` aqui: o padrão de `limit` fica no service.
 */

export const listResumesQuery = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIST_MAX_LIMIT)
    .optional()
    .meta({ description: `Quantos por página (1 a ${LIST_MAX_LIMIT}; padrão ${LIST_DEFAULT_LIMIT}).` }),
  cursor: z.string().min(1).optional().meta({ description: "O `nextCursor` da página anterior." }),
  status: z.enum(RESUME_STATUSES).optional().meta({ description: "Só os currículos neste status." }),
});

/** Item da lista: o bastante para identificar o currículo, sem dado pessoal. */
export const resumeListItem = z.object({
  id: z.string(),
  status: z.enum(RESUME_STATUSES),
  headline: z.string().nullable(),
  area: z.enum(AREAS).nullable(),
  seniority: z.enum(SENIORITIES).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const listResumesResponse = z
  .object({
    items: z.array(resumeListItem),
    nextCursor: z.string().nullable().meta({ description: "Passe em `cursor` para a próxima página; null na última." }),
  })
  .meta({ id: "ResumeList" });

export type ListResumesQuery = z.infer<typeof listResumesQuery>;
export type ListResumesResponse = z.infer<typeof listResumesResponse>;
