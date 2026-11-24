import type { Database } from "@/db/client";
import { resumesRoutes } from "./routes/resumes";
import { createResumesService } from "./services/resumes";

/* A feature de currículos montada para a API. A fila e o processamento ficam em src/resumes, fora do HTTP. */
export const resumesFeature = ({ db }: { db: Database }) => resumesRoutes(createResumesService({ db }));
