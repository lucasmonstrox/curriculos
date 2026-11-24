import { z } from "zod";
import { DEFAULT_METHOD_ID, METHOD_IDS } from "@/similarity/methods";
import { DEFAULT_TOP } from "@/similarity/recommend";
import { SIMILAR_MAX_TOP } from "../consts";

/* Os currículos mais parecidos com um currículo. Os padrões (top, método, nota mínima) ficam no service. */

export const similarResumesQuery = z.object({
  top: z.coerce
    .number()
    .int()
    .min(1)
    .max(SIMILAR_MAX_TOP)
    .optional()
    .meta({ description: `Quantos recomendar no máximo (1 a ${SIMILAR_MAX_TOP}; padrão ${DEFAULT_TOP}).` }),
  method: z
    .enum(METHOD_IDS)
    .optional()
    .meta({ description: `Como medir a semelhança (padrão: ${DEFAULT_METHOD_ID}, o melhor no benchmark do README).` }),
  minScore: z.coerce.number().min(-1).max(1).optional().meta({
    description:
      "Nota mínima para recomendar (padrão: a calibrada para o método). Métodos que só ordenam (sections-rrf, sections-zscore) não cortam.",
  }),
});

export const similarResume = z.object({
  id: z.string(),
  headline: z.string(),
  summary: z.string().meta({ description: "Resumo da carreira, para mostrar por que é parecido." }),
  score: z.number().meta({ description: "Nota de semelhança; maior é mais parecido." }),
});

export const similarResumesResponse = z
  .object({
    method: z.enum(METHOD_IDS),
    minScore: z.number().nullable().meta({ description: "Nota mínima aplicada; null quando o método não corta." }),
    items: z.array(similarResume).meta({ description: "Do mais para o menos parecido; pode vir vazia." }),
  })
  .meta({ id: "SimilarResumes" });

export type SimilarResumesQuery = z.infer<typeof similarResumesQuery>;
export type SimilarResumesResponse = z.infer<typeof similarResumesResponse>;
