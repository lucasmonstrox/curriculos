/*
 * Dinheiro anda em centavos (inteiro) por todo o projeto; esta é a única porta para mostrar como
 * texto. Nada de multiplicar ou dividir por 100 espalhado pelo código.
 */
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 900000 → "R$ 9.000,00". */
export const formatCents = (cents: number): string => BRL.format(cents / 100);
