/*
 * Listas para montar formações e cidades fictícias. Nome, e-mail e telefone vêm do Faker
 * (lab/generator/resume.ts), com e-mail sempre em @example.com, domínio reservado para exemplo.
 */

export const CITIES = [
  ["São Paulo", "SP"],
  ["Campinas", "SP"],
  ["Rio de Janeiro", "RJ"],
  ["Belo Horizonte", "MG"],
  ["Curitiba", "PR"],
  ["Porto Alegre", "RS"],
  ["Florianópolis", "SC"],
  ["Recife", "PE"],
  ["Salvador", "BA"],
  ["Fortaleza", "CE"],
  ["Goiânia", "GO"],
  ["Brasília", "DF"],
  ["Vitória", "ES"],
  ["Manaus", "AM"],
] as const;

export const UNIVERSITIES = [
  "USP",
  "Unicamp",
  "UFMG",
  "UFRJ",
  "PUC-Rio",
  "Mackenzie",
  "Uninove",
  "Unip",
  "Fatec",
  "UFPR",
  "UFRGS",
  "UFBA",
  "UFPE",
  "Estácio",
  "Anhanguera",
  "FGV",
] as const;

export const TECHNICAL_SCHOOLS = ["Senai", "Etec", "IFES"] as const;

/** Cursos sem relação com a profissão: gente que se formou numa coisa e trabalha em outra. */
export const UNRELATED_COURSES = [
  "Administração",
  "Engenharia de Produção",
  "Letras",
  "Economia",
  "Direito",
  "Ciências Biológicas",
] as const;

export const POSTGRADUATE_TOPICS = [
  "Gestão de Projetos",
  "Gestão Empresarial",
  "Data Science",
  "Marketing Digital",
  "Finanças",
  "Liderança",
] as const;

/** Atividades que cabem em qualquer profissão: ruído que aproxima currículos diferentes. */
export const GENERIC_ACTIVITIES = [
  "Trabalhava com metodologia ágil.",
  "Apresentava os resultados para a diretoria.",
  "Participou da contratação de pessoas para o time.",
  "Treinou os colegas novos.",
] as const;
