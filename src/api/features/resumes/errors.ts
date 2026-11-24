import { AppError } from "@/api/errors";
import type { ResumeStatus } from "@/domain/status";

/* Os erros da feature de currículos, com a mensagem específica de cada caso (códigos em src/api/errors.ts). */

export const resumeNotFound = (id: string) => new AppError("RESUME_NOT_FOUND", `Currículo ${id} não encontrado.`);

export const resumeNotReady = (id: string, status: ResumeStatus) =>
  new AppError(
    "RESUME_NOT_READY",
    `O currículo ${id} ainda não está pronto (status: ${status}). Ele entra nas recomendações quando o processamento terminar.`,
  );

export const resumeNotFailed = (id: string, status: ResumeStatus) =>
  new AppError("RESUME_NOT_FAILED", `Só dá para tentar de novo um currículo que falhou; o ${id} está ${status}.`);
