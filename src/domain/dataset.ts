import { z } from "zod";
import { MONTH_PATTERN } from "../utils/month";
import { resumeSchema } from "./resume";

/*
 * Um conjunto de currículos para recomendar entre si, em arquivo: é o que a linha de comando
 * `recommend` lê (a API guarda os currículos no banco). O laboratório estende este formato com o
 * gabarito dos conjuntos sintéticos (lab/dataset.ts).
 */
export const datasetSchema = z.object({
  /** O "agora" do conjunto: o emprego atual conta até este mês nas contas de duração e recência. */
  referenceMonth: z.string().regex(MONTH_PATTERN),
  resumes: z.array(resumeSchema).min(2),
});

export type Dataset = z.infer<typeof datasetSchema>;
