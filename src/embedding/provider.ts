/**
 * Quem transforma texto em vetor. O serviço externo (OpenAI) fica atrás deste tipo: o cache embrulha
 * qualquer provedor, os testes usam um provedor falso e trocar de fornecedor mexe só no arquivo dele.
 */
export type EmbeddingProvider = {
  /** Modelo e dimensões. Muda o vetor, então entra na chave do cache. */
  readonly id: string;
  /** Um vetor por texto, na mesma ordem dos textos. */
  embed(texts: readonly string[]): Promise<number[][]>;
};
