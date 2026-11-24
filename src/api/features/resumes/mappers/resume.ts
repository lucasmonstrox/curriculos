import { formatISO } from "date-fns";
import type { ResumeRow } from "@/db/schema";
import { careerSummary } from "@/domain/summary";
import type { ListResumesResponse } from "../dtos/list-resumes";
import type { QueuedResponse, ResumeResponse } from "../dtos/resume";

/*
 * Linha do banco → resposta da API. Funções puras: sem banco, sem Elysia. A resposta sai daqui, nunca
 * a linha inteira: o texto original (com dados pessoais) não vai para fora por descuido.
 */

export const toQueuedResponse = (row: ResumeRow): QueuedResponse => ({ id: row.id, status: row.status });

export function toResumeResponse(row: ResumeRow, reference: Date): ResumeResponse {
  return {
    id: row.id,
    status: row.status,
    data: row.data,
    summary: row.data ? careerSummary(row.data, reference) : null,
    attempts: row.attempts,
    error: row.lastError,
    createdAt: formatISO(row.createdAt),
    updatedAt: formatISO(row.updatedAt),
  };
}

export const toListItem = (row: ResumeRow): ListResumesResponse["items"][number] => ({
  id: row.id,
  status: row.status,
  headline: row.data?.headline ?? null,
  area: row.data?.area ?? null,
  seniority: row.data?.seniority ?? null,
  createdAt: formatISO(row.createdAt),
});
