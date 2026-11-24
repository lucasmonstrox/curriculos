import { AREA_LABELS, SECTOR_LABELS, SENIORITY_LABELS } from "@/domain/labels";
import { careerSummary, describeDuration } from "@/domain/summary";
import { experienceMonths } from "@/domain/timeline";
import { parseMonth } from "@/utils/month";
import { closenessOf } from "../evaluation/truth";
import { type ExamplePagesInput, pagePath, professionFolder } from "./example-pages";

/*
 * O grafo de docs/exemplos/grafo.html: um nó por currículo, com a cor da profissão de hoje, e uma
 * ligação por recomendação mostrada. A cor da ligação diz se a recomendação faz sentido pelo gabarito
 * (verde: parecido; amarelo: em parte; vermelho: nada a ver). Clicar num nó abre o currículo ao lado.
 *
 * A página é um arquivo só: os dados vão embutidos em JSON e o layout de forças vem do d3 (cdnjs).
 */

// Versão fixa do d3: a página não pode mudar sozinha quando sair uma versão nova.
const D3_URL = "https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js";

type GraphNode = {
  id: string;
  headline: string;
  profession: string;
  group: string;
  career: string;
  summary: string;
  meta: string;
  skills: string[];
  jobs: { title: string; where: string; period: string }[];
  page: string;
};

type GraphLink = { source: string; target: string; score: number; closeness: string };

export function renderGraphPage(input: ExamplePagesInput): string {
  const { dataset, result, truth } = input;
  const reference = parseMonth(dataset.referenceMonth);

  const nodes: GraphNode[] = dataset.resumes.map((resume, index) => ({
    id: resume.id,
    headline: resume.headline,
    profession: truth.currents[index]!,
    group: professionFolder(truth, index),
    career: truth.careers[index]!,
    summary: careerSummary(resume, reference),
    meta: `${AREA_LABELS[resume.area]} · ${SENIORITY_LABELS[resume.seniority]} · ${resume.experiences.length} empregos`,
    skills: resume.skills,
    jobs: resume.experiences.map((e) => ({
      title: e.title,
      where: `${e.company} (${SECTOR_LABELS[e.sector]})`,
      period: `${e.start} a ${e.end ?? "atual"} · ${describeDuration(experienceMonths(e, reference))}`,
    })),
    page: pagePath(input, index),
  }));

  const links: GraphLink[] = result.shown.flatMap((shown, index) =>
    shown.map((r) => ({
      source: dataset.resumes[index]!.id,
      target: dataset.resumes[r.index]!.id,
      score: r.score,
      closeness: closenessOf(truth.matrix[index]![r.index]!),
    })),
  );

  // "</" dentro do JSON fecharia a tag <script> antes da hora.
  const json = JSON.stringify({ nodes, links, method: input.method.label, seed: dataset.seed }).replaceAll(
    "</",
    "<\\/",
  );
  // Substituição por função: com um texto no lugar, o replace interpretaria sequências como $& e $' vindas dos dados.
  return TEMPLATE.replace("__D3__", () => D3_URL).replace("__DATA__", () => json);
}

const TEMPLATE = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grafo de currículos</title>
<style>
:root {
  --bg: #f7f6f3; --panel: #ffffff; --ink: #1d1d1b; --muted: #6b6a66; --line: #e4e2dc;
  --similar: #2f8f5b; --partial: #c9922e; --unrelated: #c4473a;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #161614; --panel: #1f1f1c; --ink: #ecebe6; --muted: #a09f99; --line: #33322e;
    --similar: #55b984; --partial: #e0ac4c; --unrelated: #e2685b;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
.layout { display: grid; grid-template-columns: 1fr 380px; height: 100vh; }
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; grid-template-rows: 60vh auto; height: auto; } }
.stage { position: relative; overflow: hidden; }
svg { width: 100%; height: 100%; display: block; cursor: grab; }
header { position: absolute; top: 16px; left: 16px; right: 16px; pointer-events: none; }
header h1 { font-size: 16px; margin: 0 0 4px; }
header p { margin: 0; color: var(--muted); max-width: 560px; }
.legend { position: absolute; left: 16px; bottom: 16px; display: flex; flex-wrap: wrap; gap: 6px 12px;
  max-width: calc(100% - 32px); color: var(--muted); font-size: 12px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.bar { width: 18px; height: 3px; display: inline-block; border-radius: 2px; }
aside { background: var(--panel); border-left: 1px solid var(--line); padding: 20px 20px 32px; overflow-y: auto; }
@media (max-width: 860px) { aside { border-left: 0; border-top: 1px solid var(--line); } }
aside h2 { font-size: 18px; margin: 0 0 2px; }
aside h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 18px 0 6px; }
aside .meta, aside .empty { color: var(--muted); }
aside ul { margin: 0; padding-left: 18px; }
aside li { margin: 0 0 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chips span { border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; font-size: 12px; }
.rec { display: flex; justify-content: space-between; gap: 8px; width: 100%; text-align: left; background: none;
  border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin: 0 0 6px; color: inherit; font: inherit; cursor: pointer; }
.rec:hover { border-color: var(--muted); }
.rec small { color: var(--muted); }
a { color: inherit; }
.node circle { stroke: var(--panel); stroke-width: 2px; cursor: pointer; }
.node text { font-size: 10px; fill: var(--muted); pointer-events: none; }
.node.selected circle { stroke: var(--ink); stroke-width: 3px; }
.link { stroke-opacity: .55; }
.link.similar { stroke: var(--similar); } .link.partial { stroke: var(--partial); } .link.unrelated { stroke: var(--unrelated); }
.faded { opacity: .12; }
</style>
</head>
<body>
<div class="layout">
  <div class="stage">
    <header>
      <h1>Currículos parecidos</h1>
      <p id="subtitle"></p>
    </header>
    <svg id="graph" role="img" aria-label="Grafo de currículos ligados pelas recomendações"></svg>
    <div class="legend" id="legend"></div>
  </div>
  <aside id="panel"><p class="empty">Clique numa pessoa para abrir o currículo.</p></aside>
</div>
<script id="data" type="application/json">__DATA__</script>
<script src="__D3__"></script>
<script>
const data = JSON.parse(document.getElementById("data").textContent);
const byId = new Map(data.nodes.map((n) => [n.id, n]));
document.getElementById("subtitle").textContent =
  data.nodes.length + " currículos fictícios (semente " + data.seed + "). Cada ligação é uma recomendação: " + data.method + ".";

// Paleta categórica que funciona no claro e no escuro; uma cor por profissão de hoje.
const PALETTE = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7",
  "#9c755f", "#bab0ac", "#17becf", "#bcbd22", "#3b4cc0", "#c2185b", "#b35806", "#6a3d9a"];
const groups = [...new Set(data.nodes.map((n) => n.group))];
const color = (group) => PALETTE[groups.indexOf(group) % PALETTE.length];
const professionOf = new Map(data.nodes.map((n) => [n.group, n.profession]));

const legend = document.getElementById("legend");
for (const group of groups) legend.append(item("dot", color(group), professionOf.get(group)));
legend.append(item("bar", "var(--similar)", "parecido"), item("bar", "var(--partial)", "em parte"), item("bar", "var(--unrelated)", "nada a ver"));
function item(kind, background, text) {
  const span = document.createElement("span");
  const mark = document.createElement("i");
  mark.className = kind; mark.style.background = background;
  span.append(mark, document.createTextNode(text));
  return span;
}

const svg = d3.select("#graph");
const view = svg.append("g");
const zoom = d3.zoom().scaleExtent([0.2, 4]).on("zoom", (event) => view.attr("transform", event.transform));
svg.call(zoom);

const links = data.links.map((l) => ({ ...l }));
const nodes = data.nodes.map((n) => ({ ...n }));
const box = () => svg.node().getBoundingClientRect();

// Forças: as recomendações puxam (quanto maior a nota, mais perto), os nós se empurram, e cada
// profissão tem um leve ímã próprio para os grupos aparecerem como ilhas.
const angle = (group) => (groups.indexOf(group) / groups.length) * 2 * Math.PI;
const simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links).id((d) => d.id).distance((l) => 30 + (1 - l.score) * 260).strength(0.5))
  .force("charge", d3.forceManyBody().strength(-140))
  .force("x", d3.forceX((d) => box().width / 2 + Math.cos(angle(d.group)) * box().width * 0.28).strength(0.05))
  .force("y", d3.forceY((d) => box().height / 2 + Math.sin(angle(d.group)) * box().height * 0.28).strength(0.05))
  .force("collide", d3.forceCollide(16));

const link = view.append("g").selectAll("line").data(links).join("line")
  .attr("class", (l) => "link " + l.closeness).attr("stroke-width", (l) => 1 + (l.score - 0.6) * 8);
const node = view.append("g").selectAll("g").data(nodes).join("g").attr("class", "node")
  .call(d3.drag()
    .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
    .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
    .on("end", (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }))
  .on("click", (_, d) => select(d.id));
node.append("circle").attr("r", 9).attr("fill", (d) => color(d.group));
node.append("text").attr("dy", 20).attr("text-anchor", "middle").text((d) => d.id);
node.append("title").text((d) => d.id + " · " + d.headline);

simulation.on("tick", () => {
  link.attr("x1", (l) => l.source.x).attr("y1", (l) => l.source.y).attr("x2", (l) => l.target.x).attr("y2", (l) => l.target.y);
  node.attr("transform", (d) => "translate(" + d.x + "," + d.y + ")");
});

// Quando o layout assenta, enquadra todos os nós na tela, com espaço em cima para o título e embaixo
// para a legenda.
simulation.on("end", () => {
  const { width, height } = box();
  const top = 90, bottom = 110, side = 40;
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((width - 2 * side) / (maxX - minX || 1), (height - top - bottom) / (maxY - minY || 1), 1.6);
  const x = side + (width - 2 * side - (maxX - minX) * scale) / 2 - minX * scale;
  const y = top + (height - top - bottom - (maxY - minY) * scale) / 2 - minY * scale;
  svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
});

// Seleção: destaca a pessoa e as ligações dela, apaga o resto e abre o currículo no painel.
function select(id) {
  const linked = new Set([id]);
  for (const l of links) if (l.source.id === id || l.target.id === id) { linked.add(l.source.id); linked.add(l.target.id); }
  node.classed("selected", (d) => d.id === id).classed("faded", (d) => !linked.has(d.id));
  link.classed("faded", (l) => l.source.id !== id && l.target.id !== id);
  render(byId.get(id));
}

function el(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function render(person) {
  const panel = document.getElementById("panel");
  panel.replaceChildren();
  panel.append(el("h2", person.id + " · " + person.headline), el("p", person.meta, "meta"));
  panel.append(el("h3", "Carreira, pelo gabarito"), el("p", person.career));
  panel.append(el("h3", "Resumo"), el("p", person.summary));

  panel.append(el("h3", "Recomendados"));
  const recommended = data.links.filter((l) => l.source === person.id);
  if (!recommended.length) panel.append(el("p", "Nenhum currículo parecido o bastante.", "empty"));
  for (const l of recommended) {
    const other = byId.get(l.target);
    const button = el("button", undefined, "rec");
    button.append(el("span", other.id + " · " + other.headline), el("small", l.score.toFixed(3) + " · " + LABELS[l.closeness]));
    button.addEventListener("click", () => select(other.id));
    panel.append(button);
  }

  panel.append(el("h3", "Habilidades"));
  const chips = el("div", undefined, "chips");
  for (const skill of person.skills) chips.append(el("span", skill));
  panel.append(chips);

  panel.append(el("h3", "Experiência"));
  const jobs = el("ul");
  for (const job of person.jobs) {
    const li = el("li");
    li.append(el("strong", job.title), document.createTextNode(", " + job.where), el("br"), el("small", job.period, "meta"));
    jobs.append(li);
  }
  panel.append(jobs);

  const page = el("a", "Abrir a página completa do currículo");
  page.href = person.page;
  const footer = el("p");
  footer.append(page);
  panel.append(el("h3", "Página"), footer);
}
const LABELS = { similar: "parecido", partial: "em parte", unrelated: "nada a ver" };
</script>
</body>
</html>
`;
