import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { openAIKeyFromEnv } from "../utils/env";

/*
 * O cliente da OpenAI (via AI SDK), num lugar só: o embedding (src/embedding) e a extração
 * (src/extraction) usam o mesmo, com a chave do .env. Criado na primeira chamada, para que testes e
 * comandos que não falam com a OpenAI não exijam a chave.
 */
let client: OpenAIProvider | undefined;

/**
 * Prazo de cada chamada à OpenAI (extração ou embedding), contando as novas tentativas do AI SDK. Fica
 * bem abaixo dos 10 minutos depois dos quais outro worker retoma um currículo parado
 * (STALE_AFTER_MINUTES em src/resumes/processing.ts): chamada presa vira falha, e não dois workers no
 * mesmo currículo.
 */
export const OPENAI_TIMEOUT_MS = 2 * 60_000;

export const openAI = (): OpenAIProvider => (client ??= createOpenAI({ apiKey: openAIKeyFromEnv() }));
