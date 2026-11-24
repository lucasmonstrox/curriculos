import type { OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { generateText, type LanguageModel, type ModelMessage, Output } from "ai";
import { type ExtractedResume, extractedResumeSchema } from "../domain/resume";
import { OPENAI_TIMEOUT_MS, openAI } from "../lib/openai";
import { readEnv } from "../utils/env";
import { currentMonth } from "../utils/month";
import { EXAMPLES_REFERENCE_MONTH, EXTRACTION_EXAMPLES } from "./examples";
import { EXTRACTION_INSTRUCTIONS, resumeMessage } from "./prompt";

/*
 * Leitura do currículo com um modelo de linguagem (AI SDK + OpenAI) e saída estruturada: o AI SDK
 * manda o JSON Schema do `extractedResumeSchema` ao modelo, e a OpenAI, no modo estrito, só devolve
 * o que cabe nele. O Zod valida de novo na volta (inclusive regra que o JSON Schema não expressa,
 * como o fim do emprego depois do início).
 */

/** Lê o texto de um currículo e devolve a ficha. O worker recebe uma função dessas; os testes passam outra. */
export type Extractor = (resumeText: string) => Promise<ExtractedResume>;

/** Modelo padrão da extração; troca-se pelo EXTRACTION_MODEL do .env. */
export const DEFAULT_EXTRACTION_MODEL = "gpt-6.2-sol";

// Extração é leitura atenta, não problema difícil: esforço de raciocínio baixo corta custo e tempo.
const REASONING_EFFORT = "low";

/*
 * Os exemplos entram como conversa: o usuário manda um currículo, o assistente responde a ficha.
 * Assim o modelo vê o formato e o nível de padronização esperados antes do currículo de verdade.
 */
const FEW_SHOT_MESSAGES: ModelMessage[] = EXTRACTION_EXAMPLES.flatMap(({ text, expected }) => [
  { role: "user", content: resumeMessage(text, EXAMPLES_REFERENCE_MONTH) },
  { role: "assistant", content: JSON.stringify(expected) },
]);

export type ExtractorOptions = {
  /** O modelo do AI SDK; padrão: o da OpenAI do .env (EXTRACTION_MODEL) ou DEFAULT_EXTRACTION_MODEL. */
  model?: LanguageModel;
  /** O mês de hoje, para "atual" e "até o momento"; padrão: o mês corrente. */
  referenceMonth?: () => string;
};

const defaultModel = (): LanguageModel => openAI()(readEnv().EXTRACTION_MODEL ?? DEFAULT_EXTRACTION_MODEL);

export function createExtractor({
  model = defaultModel(),
  referenceMonth = currentMonth,
}: ExtractorOptions = {}): Extractor {
  return async (resumeText) => {
    const { output } = await generateText({
      model,
      instructions: EXTRACTION_INSTRUCTIONS,
      messages: [...FEW_SHOT_MESSAGES, { role: "user", content: resumeMessage(resumeText, referenceMonth()) }],
      output: Output.object({
        schema: extractedResumeSchema,
        name: "structured_resume",
        description: "Currículo padronizado para comparação com outros currículos.",
      }),
      abortSignal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
      providerOptions: { openai: { reasoningEffort: REASONING_EFFORT } satisfies OpenAILanguageModelResponsesOptions },
    });
    return sortExperiences(output);
  };
}

/**
 * Garante no código a ordem que o prompt pede (do emprego mais recente para o mais antigo pelo
 * início): o resumo e a ficha tratam o primeiro emprego como o de hoje. Texto AAAA-MM de largura
 * fixa ordena como data.
 */
export function sortExperiences(resume: ExtractedResume): ExtractedResume {
  return { ...resume, experiences: resume.experiences.toSorted((a, b) => b.start.localeCompare(a.start)) };
}
