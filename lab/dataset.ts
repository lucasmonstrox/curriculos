import { z } from "zod";
import { datasetSchema } from "@/domain/dataset";

/*
 * O conjunto sintético: o mesmo formato de conjunto do produto, mais a semente que o gerou e o
 * gabarito. O gabarito diz quantos meses cada pessoa passou em cada profissão, e é com ele que
 * lab/evaluation mede se as recomendações fazem sentido.
 */

export const truthSchema = z.object({
  /** O nome de cada profissão, pelo id (o mesmo `occupation` do catálogo). */
  professions: z.record(z.string(), z.string()),
  /** Pares de profissões vizinhas: parecidas, mas não iguais (backend e devops, por exemplo). */
  neighbors: z.array(z.tuple([z.string(), z.string()])),
  /** A carreira de cada currículo, pelo id: a profissão de hoje e os meses em cada profissão. */
  careers: z.record(
    z.string(),
    z.object({
      current: z.string(),
      months: z.record(z.string(), z.number().int().positive()),
    }),
  ),
});

export const labDatasetSchema = datasetSchema.extend({
  seed: z.number().int(),
  truth: truthSchema,
});

export type Truth = z.infer<typeof truthSchema>;
export type LabDataset = z.infer<typeof labDatasetSchema>;
