import { z } from "zod";

/*
 * Mensagens de validação do Zod em português ("Opção inválida..."), em vez do inglês padrão. As
 * mensagens escritas à mão nos schemas continuam valendo; esta é a língua das que o Zod gera sozinho.
 * Importado pelo schema do currículo, que todo caminho do projeto carrega.
 */
z.config(z.locales.pt());
