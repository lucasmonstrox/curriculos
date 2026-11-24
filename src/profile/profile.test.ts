import { expect, test } from "bun:test";
import { EXAMPLES_REFERENCE_MONTH, EXTRACTION_EXAMPLES } from "../extraction/examples";
import { parseMonth } from "../utils/month";
import { SECTIONS } from "../domain/sections";
import { buildProfile } from "./profile";

const reference = parseMonth(EXAMPLES_REFERENCE_MONTH);

test.each(EXTRACTION_EXAMPLES.map((example, k) => [k + 1, example.expected] as const))(
  "exemplo %i: nenhum dado pessoal nem preferência entra no texto que vira vetor (LGPD)",
  (_, data) => {
    const profile = buildProfile({ id: "x", ...data }, reference);
    const texts = [profile.whole, ...SECTIONS.map((s) => profile.sections[s]), ...profile.jobs.map((j) => j.text)];
    // A UF fica de fora da checagem: duas letras aparecem dentro de outras palavras ("SP" em "USP").
    const { state: _state, ...identifying } = data.personal;
    const personal = Object.values(identifying).filter((value): value is string => Boolean(value));
    for (const text of texts) for (const value of personal) expect(text).not.toContain(value);
    expect(profile.whole).not.toContain("R$");
  },
);

test("um vetor por emprego, sem a empresa, com a duração e o tempo desde o fim", () => {
  const data = EXTRACTION_EXAMPLES[1]!.expected; // enfermeira que virou analista de dados
  const { jobs } = buildProfile({ id: "x", ...data }, reference);
  expect(jobs).toHaveLength(3);
  expect(jobs[0]!.text).not.toContain("DadosJá");
  expect(jobs[0]).toMatchObject({ years: 5 / 12, yearsSinceEnd: 2 / 12 });
});

test("sem certificações nem idiomas, a formação não ganha linha vazia", () => {
  const resume = { id: "res_a", ...EXTRACTION_EXAMPLES[0]!.expected, certifications: [], languages: [] };
  const { education } = buildProfile(resume, reference).sections;
  expect(education).not.toContain("Certificações");
  expect(education).not.toContain("Idiomas");
  expect(education.split("\n")).toHaveLength(resume.education.length);
});
