// Recomendação de currículos: para cada candidato, os 3 outros mais parecidos com ele.
// Não é busca: não existe texto de consulta; a "consulta" é a ficha do próprio candidato.
// Compara quatro jeitos de medir a semelhança contra a verdade do gabarito.json (gerar.ts), que diz
// quanto da carreira de um cai nas mesmas profissões, ou em vizinhas, da carreira do outro.
//
// Uso (rodar nesta pasta: o Bun lê o .env da pasta atual):
//   bun recomendar.ts                    OpenAI text-embedding-3-large (precisa de OPENAI_API_KEY)
//   EMBEDDING=ollama bun recomendar.ts   modelo local do Ollama, para testar sem chave
//   bun recomendar.ts --fichas           só gera as fichas em fichas/, sem embedding
//   bun recomendar.ts --variante X       muda o que entra na ficha do vetor único (ver VARIANTES)
//   bun recomendar.ts --registrar        guarda as métricas da rodada em resultados.jsonl

import { createHash } from "node:crypto";
import { appendFile, mkdir, readdir, unlink } from "node:fs/promises";

const PROVEDOR = process.env.EMBEDDING === "ollama" ? "ollama" : "openai";
const MODELO = PROVEDOR === "openai" ? "text-embedding-3-large" : "qwen3-embedding:0.6b";
// O large tem 3072 dimensões; o parâmetro `dimensions` corta para 2048 (o modelo foi treinado para isso).
// Se for guardar no pgvector: índice HNSW no tipo `vector` vai até 2000 dimensões; acima disso, `halfvec`.
// O qwen3 local tem 1024 fixas.
const DIMENSOES = PROVEDOR === "openai" ? 2048 : 1024;
const TOP = 3;
const K_RRF = 60; // valor do artigo original do RRF; quanto maior, menos o 1º lugar pesa sobre o 2º
const SECOES = ["perfil", "habilidades", "experiencia", "formacao"] as const;
type Secao = (typeof SECOES)[number];
const PESOS: Record<Secao, number> = { perfil: 0.3, habilidades: 0.3, experiencia: 0.3, formacao: 0.1 };
type Pedaco = Secao | "cadastro";
const TITULOS: Record<Pedaco, string> = {
  perfil: "Perfil",
  habilidades: "Habilidades",
  experiencia: "Experiência profissional",
  formacao: "Formação",
  cadastro: "Dados do cadastro",
};
// Que pedaços entram na ficha do vetor único (método A).
const VARIANTES: Record<string, Pedaco[]> = {
  completa: ["perfil", "habilidades", "experiencia", "formacao"],
  sem_formacao: ["perfil", "habilidades", "experiencia"],
  habilidades_e_experiencia: ["habilidades", "experiencia"],
  so_perfil: ["perfil"],
  so_habilidades: ["habilidades"],
  so_experiencia: ["experiencia"],
  com_cadastro: ["perfil", "habilidades", "experiencia", "formacao", "cadastro"],
};
const iVariante = Bun.argv.indexOf("--variante");
const VARIANTE = iVariante > 0 ? Bun.argv[iVariante + 1]! : "completa";
if (!VARIANTES[VARIANTE]) throw new Error(`Variante desconhecida: ${VARIANTE}. Opções: ${Object.keys(VARIANTES).join(", ")}`);

const legivel = (v: string) => v.replaceAll("_", " ");
const dir = import.meta.dir;
const dados = await Bun.file(`${dir}/candidatos.json`).json();
const gabarito = await Bun.file(`${dir}/gabarito.json`).json();
const candidatos: any[] = dados.candidatos;
const ids: string[] = candidatos.map((c) => c.id);
const n = candidatos.length;

// Texto de cada seção. Nome, contato, cidade e preferências ficam fora: não dizem nada da profissão.
function secoes(c: any): Record<Secao, string> {
  const perfil = [c.titulo, `Área: ${legivel(c.area)}. Senioridade: ${legivel(c.senioridade)}. ${c.anos_experiencia} anos de experiência.`, c.resumo].join("\n");
  const habilidades = c.habilidades.join(", ");
  const experiencia = c.experiencias
    .map((e: any) => `## ${e.cargo}, ${e.empresa} (${legivel(e.setor)}, ${e.inicio} a ${e.fim ?? "atual"})\n${e.atividades.map((a: string) => `- ${a}`).join("\n")}`)
    .join("\n\n");
  const formacao = [
    ...c.formacao.map((f: any) => `${f.curso}, ${f.instituicao} (${legivel(f.nivel)})`),
    c.certificacoes.length ? `Certificações: ${c.certificacoes.join(", ")}` : "",
    `Idiomas: ${c.idiomas.map((i: any) => `${i.idioma} ${legivel(i.nivel)}`).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { perfil, habilidades, experiencia, formacao };
}
// Dados que não dizem nada da profissão: entram só na variante com_cadastro, para medir o ruído.
const cadastro = (c: any) =>
  `${c.cidade} (${c.uf})\nAceita: ${c.preferencias.modelos.join(", ")}. Regime: ${c.preferencias.regime}. Disponibilidade: ${legivel(c.preferencias.disponibilidade)}. Pretensão: R$ ${Math.round(c.preferencias.pretensao_salarial_centavos / 100)} por mês.`;
const ficha = (s: Record<Secao, string>, c: any) =>
  VARIANTES[VARIANTE]!.map((k) => `# ${TITULOS[k]}\n${k === "cadastro" ? cadastro(c) : s[k]}`).join("\n\n");

const porSecao = candidatos.map(secoes);
const fichas = porSecao.map((s, i) => ficha(s, candidatos[i]));
await mkdir(`${dir}/fichas`, { recursive: true });
for (const f of await readdir(`${dir}/fichas`)) if (f.endsWith(".md")) await unlink(`${dir}/fichas/${f}`); // fichas de um conjunto anterior
await Promise.all(ids.map((id, i) => Bun.write(`${dir}/fichas/${id}.md`, fichas[i]! + "\n")));
console.log(`${n} fichas em ${dir}/fichas/ (média de ${Math.round(fichas.reduce((s, f) => s + f.length, 0) / n)} caracteres)`);
if (Bun.argv.includes("--fichas")) process.exit(0);

const CHAVE_API = process.env.OPENAI_API_KEY;
if (PROVEDOR === "openai" && !CHAVE_API) {
  console.error("Falta OPENAI_API_KEY: crie um .env nesta pasta com OPENAI_API_KEY=... e rode de novo.");
  process.exit(1);
}

// Embedding com cache em disco: rodar de novo (mudando peso ou método) não chama o modelo outra vez.
const CACHE = `${dir}/embeddings-cache.json`;
const normalizar = (v: number[]) => {
  const t = Math.hypot(...v);
  return v.map((x) => x / t);
};
async function embed(textos: string[]): Promise<number[][]> {
  const cache: Record<string, number[]> = (await Bun.file(CACHE).exists()) ? await Bun.file(CACHE).json() : {};
  const chave = (t: string) => createHash("sha256").update(`${MODELO}|${DIMENSOES}|${t}`).digest("hex");
  const faltam = [...new Set(textos.filter((t) => !cache[chave(t)]))];
  if (faltam.length && PROVEDOR === "openai") {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${CHAVE_API}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELO, input: faltam, dimensions: DIMENSOES }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    const j: any = await r.json();
    for (const d of j.data) cache[chave(faltam[d.index]!)] = d.embedding;
    console.log(`${faltam.length} textos enviados à OpenAI (${j.usage?.total_tokens} tokens)`);
  } else if (faltam.length) {
    const r = await fetch("http://localhost:11434/api/embed", { method: "POST", body: JSON.stringify({ model: MODELO, input: faltam }) });
    if (!r.ok) throw new Error(`Ollama ${r.status}: ${await r.text()}`);
    const j: any = await r.json();
    j.embeddings.forEach((e: number[], k: number) => (cache[chave(faltam[k]!)] = e));
    console.log(`${faltam.length} textos enviados ao Ollama`);
  }
  if (faltam.length) await Bun.write(CACHE, JSON.stringify(cache));
  return textos.map((t) => normalizar(cache[chave(t)]!));
}

// Um texto por emprego (cargo, setor e atividades; a empresa fica fora), para comparar emprego com emprego.
const MES_ATUAL = 2026 * 12 + 10; // novembro de 2026, o mesmo "agora" do gerar.ts
const indiceMes = (s: string) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7)) - 1;
const empregos = candidatos.map((c) =>
  c.experiencias.map((e: any) => {
    const fim = e.fim ? indiceMes(e.fim) : MES_ATUAL;
    return {
      texto: `${e.cargo} (${legivel(e.setor)})\n${e.atividades.map((a: string) => `- ${a}`).join("\n")}`,
      anos: Math.max(1, fim - indiceMes(e.inicio)) / 12,
      anosDesdeOFim: (MES_ATUAL - fim) / 12,
    };
  }),
);
type Emprego = (typeof empregos)[number][number];

const vetores = await embed([
  ...fichas,
  ...SECOES.flatMap((s) => porSecao.map((p) => p[s] || "(vazio)")), // a API recusa texto vazio
  ...empregos.flat().map((e) => e.texto),
]);
const vetFicha = vetores.slice(0, n);
const vetSecao = Object.fromEntries(SECOES.map((s, k) => [s, vetores.slice(n * (k + 1), n * (k + 2))])) as Record<Secao, number[][]>;
let posicao = n * (SECOES.length + 1);
const vetEmprego = empregos.map((lista) => lista.map(() => vetores[posicao++]!));

const cos = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0); // vetores já normalizados
const outros = (i: number) => [...Array(n).keys()].filter((j) => j !== i);
type Rec = { j: number; nota: number }[];
const ordenar = (l: Rec): Rec => l.sort((a, b) => b.nota - a.nota);

// Cada emprego de A procura o emprego mais parecido de B (MaxSim, como no ColBERT), com peso por emprego.
function maxSim(i: number, j: number, peso: (e: Emprego) => number) {
  const w = empregos[i]!.map(peso);
  const total = w.reduce((a, b) => a + b, 0);
  return vetEmprego[i]!.reduce((s, a, k) => s + w[k]! * Math.max(...vetEmprego[j]!.map((b) => cos(a, b))), 0) / total;
}
// Mesma soma ponderada do método B, trocando o vetor único da experiência pelo MaxSim simétrico
// (média de A→B e B→A, para o currículo curto não ganhar de graça).
const porEmprego = (i: number, peso: (e: Emprego) => number): Rec =>
  ordenar(
    outros(i).map((j) => ({
      j,
      nota:
        PESOS.perfil * cos(vetSecao.perfil[i]!, vetSecao.perfil[j]!) +
        PESOS.habilidades * cos(vetSecao.habilidades[i]!, vetSecao.habilidades[j]!) +
        (PESOS.experiencia * (maxSim(i, j, peso) + maxSim(j, i, peso))) / 2 +
        PESOS.formacao * cos(vetSecao.formacao[i]!, vetSecao.formacao[j]!),
    })),
  );
const MEIA_VIDA_ANOS = 5;

const metodos: Record<string, (i: number) => Rec> = {
  "A. ficha inteira, 1 vetor": (i) => ordenar(outros(i).map((j) => ({ j, nota: cos(vetFicha[i]!, vetFicha[j]!) }))),
  "B. 1 vetor por seção, média ponderada": (i) =>
    ordenar(outros(i).map((j) => ({ j, nota: SECOES.reduce((s, k) => s + PESOS[k] * cos(vetSecao[k][i]!, vetSecao[k][j]!), 0) }))),
  // RRF: cada seção gera o seu ranking e a nota final soma peso / (K + posição). Junta as seções sem
  // precisar que as notas delas estejam na mesma escala, mas perde o "quanto" se parece.
  "C. 1 vetor por seção, RRF": (i) => {
    const nota = new Map<number, number>();
    for (const k of SECOES) {
      const ranking = outros(i).sort((a, b) => cos(vetSecao[k][i]!, vetSecao[k][b]!) - cos(vetSecao[k][i]!, vetSecao[k][a]!));
      ranking.forEach((j, pos) => nota.set(j, (nota.get(j) ?? 0) + PESOS[k] / (K_RRF + pos + 1)));
    }
    return ordenar([...nota].map(([j, nota]) => ({ j, nota })));
  },
  // Nota normalizada: em cada seção, quanto o outro currículo fica acima da média dos demais (em desvios).
  "D. 1 vetor por seção, nota normalizada": (i) => {
    const nota = new Map<number, number>(outros(i).map((j) => [j, 0]));
    for (const k of SECOES) {
      const notas = outros(i).map((j) => [j, cos(vetSecao[k][i]!, vetSecao[k][j]!)] as const);
      const media = notas.reduce((s, [, x]) => s + x, 0) / notas.length;
      const desvio = Math.sqrt(notas.reduce((s, [, x]) => s + (x - media) ** 2, 0) / notas.length);
      for (const [j, x] of notas) nota.set(j, nota.get(j)! + (PESOS[k] * (x - media)) / desvio);
    }
    return ordenar([...nota].map(([j, nota]) => ({ j, nota })));
  },
  "E. por emprego, pesos iguais": (i) => porEmprego(i, () => 1),
  "F. por emprego, peso pela duração": (i) => porEmprego(i, (e) => e.anos),
  // Recência com meia-vida: um emprego que acabou há 5 anos vale metade de um igual que é o atual.
  "G. por emprego, duração e recência": (i) => porEmprego(i, (e) => e.anos * Math.exp((-Math.LN2 * e.anosDesdeOFim) / MEIA_VIDA_ANOS)),
};

// Verdade: quanto da carreira de um cai nas mesmas profissões (1) ou em vizinhas (0,5) da carreira do outro.
const vizinhas = new Set((gabarito.vizinhas as [string, string][]).flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
const fatias = ids.map((id) => {
  const meses = gabarito.candidatos[id].meses as Record<string, number>;
  const total = Object.values(meses).reduce((a, b) => a + b, 0);
  return Object.entries(meses)
    .map(([p, m]) => [p, m / total] as const)
    .sort((a, b) => b[1] - a[1]);
});
const R = (p: string, q: string) => (p === q ? 1 : vizinhas.has(`${p}|${q}`) ? 0.5 : 0);
const V = ids.map((_, i) => ids.map((_, j) => fatias[i]!.reduce((s, [p, fp]) => s + fatias[j]!.reduce((t, [q, fq]) => t + fp * fq * R(p, q), 0), 0)));
const PARECIDO = 0.5;
const EM_PARTE = 0.2;
const classe = (v: number) => (v >= PARECIDO ? "parecido" : v >= EM_PARTE ? "em parte" : "nada a ver");
const verdadeOrdenada = ids.map((_, i) => outros(i).map((j) => V[i]![j]!).sort((a, b) => b - a));
const comPar = ids.map((_, i) => i).filter((i) => verdadeOrdenada[i]![0]! >= EM_PARTE);
const semPar = ids.map((_, i) => i).filter((i) => verdadeOrdenada[i]![0]! < EM_PARTE);
const carreira = (i: number) => fatias[i]!.map(([p, f]) => `${legivel(p)} ${Math.round(f * 100)}%`).join(" + ");

// Ordem do top 3 (NDCG com a verdade como ganho): 1 = a melhor ordem possível com os currículos que existem.
const dcg = (g: number[]) => g.reduce((s, x, k) => s + x / Math.log2(k + 2), 0);
function avaliar(rec: Rec[]) {
  const ndcgDe = (i: number) => dcg(rec[i]!.slice(0, TOP).map(({ j }) => V[i]![j]!)) / dcg(verdadeOrdenada[i]!.slice(0, TOP));
  const mediaNdcg = (l: number[]) => l.reduce((s, i) => s + ndcgDe(i), 0) / l.length;
  const top1NoTop3 = comPar.filter((i) => V[i]![rec[i]![0]!.j]! >= verdadeOrdenada[i]![TOP - 1]! - 1e-9).length;
  // "Mistos" = carreira com mais de uma profissão, onde o vetor único da experiência mais erra.
  return { ndcg: mediaNdcg(comPar), ndcgMistos: mediaNdcg(comPar.filter((i) => fatias[i]!.length > 1)), top1NoTop3 };
}
const recs = Object.fromEntries(Object.entries(metodos).map(([nome, f]) => [nome, ids.map((_, i) => f(i))]));
const metricas = Object.fromEntries(Object.entries(recs).map(([nome, r]) => [nome, avaliar(r)]));

console.log(`\nModelo ${MODELO}, ${DIMENSOES} dimensões, ${n} currículos, top ${TOP}, ficha "${VARIANTE}" no método A`);
console.log(`Com alguém ao menos em parte parecido: ${comPar.length}. Sem ninguém: ${semPar.length}.\n`);
console.table(
  Object.fromEntries(
    Object.entries(metricas).map(([nome, m]) => [
      nome,
      {
        "1º está entre os 3 mais parecidos de verdade": `${m.top1NoTop3}/${comPar.length}`,
        "ordem do top 3 (1 = perfeita)": m.ndcg.toFixed(3),
        "ordem só nas carreiras mistas": m.ndcgMistos.toFixed(3),
      },
    ]),
  ),
);

// Corte de "ninguém parecido": só a nota absoluta diz se o 1º é parecido de verdade (RRF e nota
// normalizada sempre entregam 3 nomes). A escala muda de um modelo para outro, então o corte sai dos
// próprios dados: média menos 2 desvios das notas do mais parecido de cada um.
// Método final = F: 0,952 contra 0,939 do B (vetor único da experiência) na média dos 6 sorteios, e
// 0,931 contra 0,907 nas carreiras mistas; venceu o B em 5 dos 6. O ganho vem mais de separar os empregos
// do que do peso (E, pesos iguais, deu 0,951). Medido em 2026-11-24.
const FINAL = "F. por emprego, peso pela duração";
const recFinal = recs[FINAL]!;
const melhores = recFinal.map((r) => r[0]!.nota);
const media = melhores.reduce((s, x) => s + x, 0) / n;
const desvio = Math.sqrt(melhores.reduce((s, x) => s + (x - media) ** 2, 0) / n);
const CORTE = media - 2 * desvio;

const contagem: Record<string, number> = { parecido: 0, "em parte": 0, "nada a ver": 0 };
const linhas: string[] = [`Recomendação: ${FINAL}, ficha "${VARIANTE}", corte ${CORTE.toFixed(3)}. Verdade: 1 = mesma carreira, 0 = nada a ver.\n`];
for (const [i, id] of ids.entries()) {
  const mostradas = recFinal[i]!.slice(0, TOP).filter((r) => r.nota >= CORTE);
  linhas.push(`${id}  ${carreira(i)}  (${candidatos[i].experiencias.length} exp., atual: ${candidatos[i].titulo})`);
  if (!mostradas.length) linhas.push(`     nenhum currículo parecido (o mais parecido de verdade tinha ${verdadeOrdenada[i]![0]!.toFixed(2)})`);
  for (const { j, nota } of mostradas) {
    contagem[classe(V[i]![j]!)]!++;
    linhas.push(`     ${ids[j]}  ${carreira(j).padEnd(48)} verdade ${V[i]![j]!.toFixed(2)} (${classe(V[i]![j]!)})  nota ${nota.toFixed(3)}`);
  }
  linhas.push("");
}
await Bun.write(`${dir}/recomendacoes.txt`, linhas.join("\n"));

const total = Object.values(contagem).reduce((a, b) => a + b, 0);
const calado = (i: number) => recFinal[i]![0]!.nota < CORTE;
const pct = (x: number) => `${Math.round((100 * x) / total)}%`;
console.log(`\nRecomendação final (${FINAL}, corte ${CORTE.toFixed(3)}), lista completa em ${dir}/recomendacoes.txt`);
console.log(`Das ${total} recomendações mostradas: ${contagem.parecido} parecidas (${pct(contagem.parecido!)}), ${contagem["em parte"]} em parte (${pct(contagem["em parte"]!)}), ${contagem["nada a ver"]} nada a ver (${pct(contagem["nada a ver"]!)}).`);
console.log(`Sem ninguém parecido: ${semPar.length}; o corte calou ${semPar.filter(calado).length}. Com alguém: ${comPar.length}; o corte calou ${comPar.filter(calado).length} por engano.`);

// Onde ficou de fora alguém bem mais parecido de verdade: 0,1 acima do pior recomendado ou, quando o
// corte deixou menos de 3, alguém "parecido" (0,5 ou mais) que não apareceu.
const faltas: string[] = [];
for (const i of comPar) {
  const mostradas = recFinal[i]!.slice(0, TOP).filter((r) => r.nota >= CORTE);
  const pior = mostradas.length ? Math.min(...mostradas.map(({ j }) => V[i]![j]!)) : 0;
  const limite = mostradas.length < TOP ? PARECIDO : pior + 0.1;
  const ja = new Set(mostradas.map(({ j }) => j));
  for (const j of outros(i).filter((j) => !ja.has(j) && V[i]![j]! >= limite)) {
    const posicao = recFinal[i]!.findIndex((r) => r.j === j) + 1;
    faltas.push(`${ids[i]} (${carreira(i)}) → faltou ${ids[j]} (${carreira(j)}), verdade ${V[i]![j]!.toFixed(2)}, ficou em ${posicao}º com nota ${recFinal[i]![posicao - 1]!.nota.toFixed(3)}; o pior recomendado tinha verdade ${pior.toFixed(2)}`);
  }
}
console.log(`\nFicou de fora alguém bem mais parecido em ${new Set(faltas.map((f) => f.slice(0, 3))).size} de ${comPar.length} currículos:`);
for (const f of faltas) console.log(`  ${f}`);

if (Bun.argv.includes("--registrar")) {
  const linha = {
    modelo: MODELO,
    semente: gabarito.semente,
    variante: VARIANTE,
    caracteres_por_ficha: Math.round(fichas.reduce((s, f) => s + f.length, 0) / n),
    metodos: Object.fromEntries(
      Object.entries(metricas).map(([nome, m]) => [nome.slice(0, 1), { ndcg: m.ndcg, ndcgMistos: m.ndcgMistos, top1: m.top1NoTop3 / comPar.length }]),
    ),
    mostradas: contagem,
    sem_par: semPar.length,
    sem_par_calados: semPar.filter(calado).length,
    calados_por_engano: comPar.filter(calado).length,
  };
  await appendFile(`${dir}/resultados.jsonl`, JSON.stringify(linha) + "\n");
}
