# curriculos

Recebe currículos em texto, padroniza cada um com um modelo de linguagem, gera vetores (embeddings) e recomenda, para cada currículo, os currículos mais parecidos com ele.

É **recomendação, não busca**: não existe texto de consulta. A pergunta é sempre "quem se parece com esta pessoa?", e a resposta pode ser "ninguém", quando nenhum currículo passa da nota mínima.

- **API HTTP** em [Elysia](https://elysiajs.com), com documentação OpenAPI e acesso por token.
- **Fila de processamento** no próprio Postgres: a API responde na hora e um worker faz o trabalho lento.
- **Extração** com o [AI SDK](https://ai-sdk.dev) e a OpenAI: um prompt com regras e exemplos que devolve a ficha padronizada.
- **Vetores no Postgres** com [pgvector](https://github.com/pgvector/pgvector), no Docker, via [Drizzle](https://orm.drizzle.team).
- **Laboratório** com currículos sintéticos ([Faker](https://fakerjs.dev)) e gabarito, para medir os métodos de semelhança em vez de chutar.

## Como funciona

```
 currículo em texto
        │  POST /resumes/extract
        ▼
 ┌──────────────┐   worker   ┌─────────────────────┐   ┌──────────────────────┐   ┌────────────┐
 │ fila         │ ─────────► │ extração (modelo de │ ► │ ficha padronizada    │ ► │ vetores    │
 │ (Postgres)   │            │ linguagem + prompt) │   │ (JSON, ver abaixo)   │   │ (pgvector) │
 └──────────────┘            └─────────────────────┘   └──────────────────────┘   └────────────┘
                                                                                        │
                                       GET /resumes/{id}/similar  ◄─────────────────────┘
                                       os mais parecidos, com nota
```

1. O currículo chega como texto (ou já estruturado) e entra na fila com status `queued`.
2. O worker lê o texto com o modelo de linguagem e devolve a **ficha padronizada**: cargo, profissão de cada emprego, habilidades com nome padronizado, datas em AAAA-MM.
3. A ficha vira texto por seção (Perfil, Habilidades, Experiência, Formação) e por emprego. Cada pedaço vira um vetor do `text-embedding-3-large` (2048 dimensões), guardado no Postgres.
4. Para recomendar, compara-se seção com seção e emprego com emprego, e só aparece quem passa da nota mínima.

## Configuração

Você precisa de [Bun](https://bun.sh) 1.4.4 ou mais novo (o 1.2 cai ao fechar a conexão com o Postgres no fim dos testes; `bun upgrade` atualiza), [Docker](https://www.docker.com) (no Windows, o Docker Desktop) e uma chave da [OpenAI](https://platform.openai.com/api-keys).

**1. Dependências**

```bash
bun install
```

**2. Variáveis de ambiente.** Copie o modelo e preencha a chave da OpenAI:

```bash
cp .env.example .env
```

```dotenv
OPENAI_API_KEY=sk-...
```

O Bun lê o `.env` sozinho. O `.env` fica fora do git; só o `.env.example`, sem chave, vai para o repositório. As outras variáveis são opcionais:

| Variável            | Padrão                                                      | Para quê                                                                                           |
| ------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`    | (obrigatória)                                               | Extração e embedding, os dois na OpenAI.                                                           |
| `API_TOKEN`         | (vazio)                                                     | Token das rotas de currículo (ver [Acesso](#acesso)). Obrigatório em produção, com 16+ caracteres. |
| `EXTRACTION_MODEL`  | `gpt-6.2-sol`                                               | Modelo que lê o currículo.                                                                         |
| `DATABASE_URL`      | `postgres://postgres:postgres@localhost:54370/resumes`      | Banco da API, do worker e da linha de comando.                                                     |
| `TEST_DATABASE_URL` | `postgres://postgres:postgres@localhost:54370/resumes_test` | Banco dos testes (as tabelas são esvaziadas a cada teste).                                         |
| `HOST`              | `localhost`                                                 | Onde a API escuta. Num contêiner ou servidor, `0.0.0.0`.                                           |
| `PORT`              | `3000`                                                      | Porta da API.                                                                                      |
| `NODE_ENV`          | `development`                                               | Em `production`, a documentação desliga e o `API_TOKEN` vira obrigatório.                          |

**3. Banco.** Sobe o Postgres com pgvector no Docker, na porta 54370 (para não brigar com um Postgres que já rode na 5432), e aplica as migrações:

```bash
bun run db:up
bun run db:migrate
```

O `db:migrate` liga a extensão `vector` e cria as tabelas. O `docker/init.sql` cria também o banco dos testes, `resumes_test`, mas só na primeira vez que o volume sobe. Se o volume já existia antes desse arquivo, crie à mão:

```bash
docker compose exec db psql -U postgres -c "CREATE DATABASE resumes_test"
```

**4. Conferir.** Com o banco de pé, os testes passam sem chamar a OpenAI:

```bash
bun test
```

## Subir a API e o worker

```bash
bun run dev
```

Sobe a API e o worker no mesmo processo e recarrega ao salvar um arquivo. Um cuidado: se o recarregamento acontecer no meio de um currículo, ele fica em `processing` até o prazo de 10 minutos passar e outro worker retomar. Para processar muitos currículos, prefira os dois separados, sem recarregar:

```bash
bun run api      # só a API HTTP
bun run worker   # só o processamento da fila (pode rodar quantos quiser)
```

A API responde em `http://localhost:3000`. Para conferir: `curl http://localhost:3000/health` devolve `{"status":"ok"}`.

## Documentação da API (OpenAPI)

Com a API de pé, abra no navegador:

- **http://localhost:3000/openapi**: a documentação interativa (Scalar), com cada rota, o formato de entrada e saída de cada status, os erros e um botão para mandar a requisição dali mesmo. Com `API_TOKEN`, preencha o token em "Authentication".
- **http://localhost:3000/openapi/json**: a especificação OpenAPI em JSON, para importar no Postman, Insomnia ou Bruno, ou gerar um cliente.

A documentação sai do próprio código: cada rota declara o schema Zod de entrada e de saída (`src/api/features/resumes/dtos/`) e um `detail` com resumo e descrição. Mudou a rota, a documentação muda junto. Com `NODE_ENV=production`, as duas páginas ficam desligadas.

## Acesso

A API devolve dado pessoal (nome, contato, pretensão salarial). Com `API_TOKEN` no ambiente, toda rota de currículo exige o cabeçalho:

```
Authorization: Bearer <o API_TOKEN>
```

Sem ele, ou com o token errado, a resposta é 401, antes mesmo de ler o corpo. `/health` e a documentação continuam abertos. Sem `API_TOKEN`, as rotas ficam abertas e a API avisa ao subir: serve só para a sua máquina, que é onde ela escuta por padrão (`HOST=localhost`). Em produção (`NODE_ENV=production`), a API nem sobe sem token.

É um token só, para quem chama a API (outro sistema, um painel). Contas de usuário e permissões por pessoa ficam para quem integrar.

## Usando a API

| Método   | Rota                    | O que faz                                                                        |
| -------- | ----------------------- | -------------------------------------------------------------------------------- |
| `POST`   | `/resumes/extract`      | Manda um currículo em texto. Entra na fila (202).                                |
| `POST`   | `/resumes`              | Manda um currículo já estruturado (a ficha). Entra na fila (202).                |
| `GET`    | `/resumes/{id}`         | O currículo: status na fila, ficha e resumo da carreira.                         |
| `GET`    | `/resumes/{id}/similar` | Os mais parecidos. Parâmetros: `top` (padrão 3), `method`, `minScore`.           |
| `GET`    | `/resumes`              | Lista, do mais novo para o mais antigo. Parâmetros: `limit`, `cursor`, `status`. |
| `POST`   | `/resumes/{id}/retry`   | Põe de volta na fila um currículo que falhou.                                    |
| `DELETE` | `/resumes/{id}`         | Apaga o currículo, o texto original e todos os vetores dele.                     |
| `GET`    | `/health`               | Saúde da API.                                                                    |

Limites: o texto do currículo vai de 50 a 50.000 caracteres; o currículo estruturado, até 50.000 caracteres e 30 empregos. Mais que isso é recusado (422), para um corpo grande não virar milhares de chamadas pagas de embedding.

### Exemplo de ponta a ponta

Com `bun run dev` rodando, mande um dos currículos de `samples/` (com `API_TOKEN`, acrescente `-H "authorization: Bearer $API_TOKEN"` em cada `curl`):

```bash
bun -e 'console.log(JSON.stringify({ text: await Bun.file("samples/paulo-ciencia-de-dados.txt").text() }))' \
  | curl -s -X POST http://localhost:3000/resumes/extract -H "content-type: application/json" -d @-
# {"id":"res_01a2...","status":"queued"}
```

Em alguns segundos o worker termina:

```bash
curl -s http://localhost:3000/resumes/res_01a2...
# {"id":"res_01a2...","status":"ready","data":{...},"summary":"12 anos de experiência: 7 anos como cientista de dados, ...",...}
```

E a recomendação:

```bash
curl -s "http://localhost:3000/resumes/res_01a2.../similar?top=3"
# {"method":"jobs-duration","minScore":0.734,"items":[{"id":"res_...","headline":"Cientista de Dados","summary":"...","score":0.839}, ...]}
```

Para ter com quem comparar, ponha na fila os 40 currículos sintéticos do laboratório:

```bash
bun run lab:seed
```

### Erros

Todo erro tem o mesmo corpo: `{ "error": "mensagem para mostrar", "code": "CODIGO_ESTAVEL" }`. Na validação vem também `fields`, com a mensagem de cada campo:

```json
{
  "error": "Dados inválidos.",
  "code": "VALIDATION_FAILED",
  "fields": { "text": ["O currículo precisa ter pelo menos 50 caracteres."] }
}
```

| Status | Código              | Quando                                                     |
| ------ | ------------------- | ---------------------------------------------------------- |
| 400    | `INVALID_JSON`      | O corpo não é um JSON válido.                              |
| 401    | `UNAUTHORIZED`      | Falta o token, ou ele não confere (só com `API_TOKEN`).    |
| 404    | `RESUME_NOT_FOUND`  | O id não existe.                                           |
| 404    | `ROUTE_NOT_FOUND`   | A rota não existe.                                         |
| 409    | `RESUME_NOT_READY`  | Pediu recomendação de um currículo que ainda está na fila. |
| 409    | `RESUME_NOT_FAILED` | Pediu `retry` de um currículo que não falhou.              |
| 422    | `VALIDATION_FAILED` | Corpo, parâmetro ou query fora do formato.                 |
| 500    | `INTERNAL_ERROR`    | Erro inesperado (o detalhe fica só no log do servidor).    |

Os códigos e as mensagens padrão ficam em `src/api/errors.ts`.

## A fila de processamento

A fila é a própria tabela `resumes` no Postgres, sem biblioteca e sem Redis:

```
queued ──► processing ──► ready
               │
               └─► erro: volta para queued, espera 30 s, depois 60 s ──► na 3ª falha: failed  (POST /retry recoloca)
```

- **Entrar na fila** é só gravar o currículo com `status = 'queued'`. A API responde 202 na hora.
- **Sair da fila**: o worker pega o próximo com uma consulta só, que marca `processing` e conta a tentativa. O `FOR UPDATE SKIP LOCKED` faz dois workers ao mesmo tempo nunca pegarem o mesmo currículo: o segundo pula a linha travada pelo primeiro e pega a seguinte. Dá para rodar quantos workers quiser.
- **Processar** é extrair a ficha (se veio texto), gerar os vetores e gravar tudo numa transação, que só então marca `ready`. A ficha extraída é gravada antes do embedding, então uma falha no embedding não faz pagar a extração de novo.
- **Falhar** devolve para a fila com uma espera que dobra (30 s, depois 60 s), para um limite de taxa da OpenAI passar em vez de queimar as 3 tentativas em segundos. Na 3ª falha vira `failed`. Quem chama a API vê só em que passo falhou ("Não foi possível gerar os vetores do currículo."); o erro técnico fica no log do worker.
- **Posse**: cada tentativa tem um número, e só grava quem ainda tem o número atual. Um worker atrasado, já substituído por outro, descarta o próprio resultado em vez de sobrescrever o do novo.
- **Worker que morre no meio**: um currículo parado em `processing` há mais de 10 minutos volta para outro worker. Se ele derrubou o worker em todas as 3 tentativas, vira `failed` em vez de rodar para sempre.
- **Prazo**: cada chamada à OpenAI tem 2 minutos, bem abaixo dos 10 minutos de cima. E um erro fora do processamento de um currículo (o banco caiu, por exemplo) não derruba o worker: ele avisa no log, espera e tenta de novo.

Por que não BullMQ ou pg-boss: o Postgres já está aqui (é ele que guarda os vetores), então a fila não acrescenta infraestrutura, e as regras dela cabem em poucas linhas que dá para ler e testar (`src/resumes/repository.ts` e `src/resumes/processing.ts`). Se um dia precisar de agendamento ou de painel de filas, o pg-boss usa o mesmo Postgres e entra no lugar.

## A extração: o que o prompt devolve

O modelo de linguagem lê o currículo como veio (colado de um PDF, com abreviações, datas como "mar/2021") e devolve a **ficha padronizada**, no formato de `src/domain/resume.ts`. O AI SDK manda esse formato ao modelo como JSON Schema e a OpenAI, no modo estrito, só responde o que cabe nele. O Zod valida de novo na volta.

- **As instruções** estão em `src/extraction/prompt.ts`. As listas de valores (área, setor, nível) e a régua de senioridade são escritas a partir de `src/domain`, nunca copiadas à mão.
- **Os exemplos**, três currículos brutos com a ficha esperada de cada um, estão em `src/extraction/examples.ts` e entram como conversa antes do currículo de verdade: um com escrita bagunçada, uma troca de carreira e uma carreira mista com freelance.
- **O currículo vai entre as marcas `<curriculo>` e `</curriculo>`**, e o prompt diz que o que está lá dentro é dado, não instrução. Uma marca escrita dentro do próprio texto é removida, para o currículo não "fechar" o trecho e escrever instruções fora dele.

As regras mais importantes:

- **Consistência acima de tudo**: a mesma coisa sempre escrita do mesmo jeito (Node.js, PostgreSQL, Power BI), para dois currículos parecidos ficarem parecidos também na ficha.
- **Não inventar**: o que o currículo não diz fica `null` ou lista vazia.
- **`occupation` em cada emprego**: a profissão em minúsculas, igual para empregos da mesma profissão ("Analista de BI" e "Analista de Dados" são `analista de dados`).
- **Datas em AAAA-MM**: só com o ano, o início vira janeiro e o fim vira dezembro; o emprego atual tem `end: null`.
- **Dados pessoais isolados** em `personal`, e preferências em `preferences`: nada disso entra no texto que vira vetor (LGPD).

Um exemplo de saída, o currículo de uma enfermeira que migrou para dados (os exemplos completos estão em `src/extraction/examples.ts`):

```json
{
  "personal": {
    "name": "Simone Batista Correia",
    "email": "simone.correia@example.com",
    "phone": null,
    "city": "Salvador",
    "state": "BA"
  },
  "headline": "Analista de Dados",
  "area": "data",
  "seniority": "junior",
  "focus": "Busca vaga de analista de dados júnior, de preferência na área da saúde.",
  "skills": ["SQL", "Power BI", "Excel", "Python", "pandas", "Indicadores hospitalares"],
  "experiences": [
    {
      "title": "Analista de Dados (projeto de bootcamp)",
      "occupation": "analista de dados",
      "company": "DadosJá",
      "sector": "education",
      "start": "2026-04",
      "end": "2026-09",
      "activities": [
        "Montou um painel no Power BI com o tempo de espera no pronto-socorro, a partir de dados abertos do SUS."
      ]
    },
    {
      "title": "Enfermeira Supervisora",
      "occupation": "enfermeira",
      "company": "Hospital Bem Viver",
      "sector": "health",
      "start": "2018-01",
      "end": "2026-03",
      "activities": ["Supervisionava 20 técnicos de enfermagem na UTI."]
    }
  ],
  "education": [{ "course": "Enfermagem", "institution": "UFBA", "level": "bachelor", "completedIn": 2015 }],
  "certifications": ["COREN ativo"],
  "languages": [
    { "language": "Português", "level": "native" },
    { "language": "Inglês", "level": "basic" }
  ],
  "preferences": {
    "workModels": ["remote"],
    "contract": null,
    "availability": "immediate",
    "salaryExpectationCents": null
  }
}
```

**O resumo da carreira não vem do modelo.** O código monta a partir das datas e do `occupation` (`src/domain/summary.ts`), porque conta de datas é onde modelo de linguagem mais erra. Para a ficha acima, sai:

> 11 anos de experiência: 10 anos como enfermeira, menos de 1 ano como analista de dados. Último cargo: analista de dados. Busca vaga de analista de dados júnior, de preferência na área da saúde.

Isso importa: no benchmark, um resumo que dizia "Analista de Marketing com 7 anos" para quem passou 5 deles em dados puxava a recomendação para o cargo atual.

Para extrair sem a API: `bun run extract samples/` grava uma ficha por arquivo em `out/extracted/`.

## Como a semelhança é calculada

Cada currículo vira 1 vetor da ficha inteira, 1 vetor por seção (Perfil, Habilidades, Experiência, Formação) e 1 vetor por emprego. A nota do método padrão, `jobs-duration`, entre dois currículos A e B é:

```
nota = 0,3 × cos(Perfil) + 0,3 × cos(Habilidades) + 0,3 × experiência + 0,1 × cos(Formação)
```

Na experiência, cada emprego de A procura o emprego mais parecido de B (a ideia do MaxSim, do ColBERT). A média dessas melhores notas é ponderada pela duração de cada emprego, nos dois sentidos (A→B e B→A), para o currículo curto não ganhar de graça. Assim, uma carreira com 6 ou 7 empregos não vira um vetor só, e cada parte dela encontra o par certo. Seção vazia (um currículo sem formação, por exemplo) não vira vetor e não conta na nota: dois currículos sem formação não ganham ponto por "terem o mesmo vazio".

- **Nota mínima, uma por método.** Só aparece quem passa dela, e a lista pode vir vazia. Cada método tem a sua porque a escala da nota muda de um para outro: é a média do corte "média menos 2 desvios" nos sorteios do benchmark (coluna "corte médio" abaixo, valores em `src/similarity/methods.ts`). Os métodos que só ordenam (`sections-rrf`, `sections-zscore`) não cortam. Trocar o modelo de embedding pede calibrar de novo com `bun run lab:benchmark`.
- **Busca em dois tempos.** O índice HNSW do pgvector pré-seleciona os 100 mais perto pela ficha inteira (rápido, aproximado) e a nota exata roda só sobre eles. O HNSW devolve no máximo `hnsw.ef_search` linhas (padrão 40), então a consulta sobe esse limite só na própria transação.
- **Leitura consistente.** O currículo pedido e os candidatos saem numa leitura só (`REPEATABLE READ`): um candidato apagado no meio não aparece sem vetores.
- **halfvec.** Os vetores ficam em `halfvec(2048)`: o índice HNSW no tipo `vector` aceita até 2000 dimensões, no `halfvec` até 4000, e ocupa metade do espaço.
- **Onde ficam os vetores.** Os dos currículos ficam só em `resume_vectors`, então apagar um currículo apaga todos os vetores dele. A linha de comando e o laboratório, que geram os mesmos textos muitas vezes, usam também um cache (`embedding_cache`), pelo hash de modelo e texto, para não pagar o mesmo texto duas vezes.

## Resultados medidos

Média e desvio de 6 sorteios de 40 currículos sintéticos (de 2 a 7 empregos, carreiras com 1 a 3 profissões), com `text-embedding-3-large` em 2048 dimensões. A "ordem do top 3" é o NDCG@3 contra o gabarito: 1 quer dizer a melhor ordem possível com os currículos que existem.

| Método (`method`)                                 | Ordem do top 3    | Só carreiras mistas | 1º entre os 3 melhores | Ganha do `sections` | Corte médio |
| ------------------------------------------------- | ----------------- | ------------------- | ---------------------- | ------------------- | ----------- |
| `whole`: ficha inteira, 1 vetor                   | 0,887 ± 0,039     | 0,810 ± 0,057       | 83,6%                  | 0 de 6              | 0,868       |
| `sections`: 1 vetor por seção                     | 0,937 ± 0,009     | 0,895 ± 0,014       | 89,9%                  |                     | 0,763       |
| `sections-rrf`: seções com RRF                    | 0,906 ± 0,015     | 0,851 ± 0,030       | 85,7%                  | 0 de 6              | não corta   |
| `sections-zscore`: seções com nota normalizada    | 0,928 ± 0,013     | 0,884 ± 0,020       | 88,7%                  | 0 de 6              | não corta   |
| `jobs-uniform`: seções + 1 vetor por emprego      | 0,957 ± 0,004     | 0,929 ± 0,011       | 93,7%                  | 6 de 6              | 0,733       |
| **`jobs-duration`: + peso pela duração (padrão)** | **0,959 ± 0,006** | **0,932 ± 0,008**   | **93,3%**              | **6 de 6**          | **0,734**   |
| `jobs-recency`: + peso pela recência              | 0,953 ± 0,006     | 0,922 ± 0,013       | 92,8%                  | 6 de 6              | 0,735       |

O que se aprendeu no caminho:

- **Separar ganha de juntar.** Numa ficha longa, a experiência ocupa quase todo o texto e abafa o perfil e as habilidades num vetor único. Separar as seções ajuda; separar também os empregos ajuda mais.
- **RRF não ajudou.** Ele junta rankings pela posição e joga fora o quanto os currículos se parecem. Aqui todas as notas vêm do mesmo modelo, já na mesma escala, e a soma ponderada ganha. Sem a nota absoluta, também não dá para dizer "ninguém é parecido".
- **Menos texto na ficha piora; mais quase não muda.** Numa rodada anterior, tirar o Perfil derrubou a ordem de 0,96 para 0,92, e acrescentar dados de cadastro (cidade, regime) não mudou nada.
- **O resumo precisa dizer o tempo em cada profissão** (ver a extração, acima).
- **O modelo pesa.** Um modelo local pequeno (qwen3-embedding 0.6B) ficou bem abaixo do `text-embedding-3-large`.

Rodar de novo: `bun run lab:benchmark`. Cuidado ao ler: os currículos são sintéticos e o gabarito é uma régua nossa (profissão vizinha vale 0,5). O próximo passo de verdade é medir com currículos reais.

## Exemplos

[`docs/exemplos/`](docs/exemplos/README.md) tem uma página por currículo sintético, separada pela profissão de hoje. Cada página mostra o currículo padronizado, a carreira pelo gabarito, os recomendados com a nota e a semelhança verdadeira, o que ficou de fora e o texto exato que virou vetor.

[`docs/exemplos/grafo.html`](docs/exemplos/grafo.html) mostra os mesmos currículos num grafo: cada pessoa é um nó com a cor da profissão, cada recomendação é uma ligação (verde quando é parecido de verdade, amarela quando é em parte, vermelha quando é nada a ver) e o clique abre o currículo. Abra o arquivo no navegador.

Gerar de novo: `bun run lab:examples`.

## Linha de comando

| Comando                               | O que faz                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `bun run extract [pasta ou arquivos]` | Lê currículos em texto (padrão: `samples/`) e grava as fichas em `out/extracted/`.                               |
| `bun run recommend [conjunto.json]`   | Recomenda entre os currículos de um conjunto em arquivo (padrão: o que o `extract` gerou), com a nota calibrada. |
| `bun run lab:generate`                | Gera um conjunto sintético com gabarito em `out/lab-dataset.json`.                                               |
| `bun run lab:benchmark`               | Compara todos os métodos nos mesmos sorteios e mede o corte de cada um.                                          |
| `bun run lab:examples`                | Gera `docs/exemplos/` e o grafo.                                                                                 |
| `bun run lab:seed`                    | Põe currículos sintéticos na fila do banco.                                                                      |
| `bun run db:generate`                 | Gera uma migração nova a partir de `src/db/schema.ts`.                                                           |

## Testes

```bash
bun run db:up            # os testes de banco usam o resumes_test do Docker
bun test                 # tudo
bun run test:unit        # só as partes puras (src e lab)
bun run test:api         # as rotas, pelo HTTP, no banco de teste
bun run test:integration # fila, processamento e cache, no banco de teste
bun run test:coverage    # tudo, com a cobertura
bun run check            # Prettier, tipos e testes com cobertura
```

- **Testes de API** (`test/api/`): cada rota pelo HTTP (`app.handle`), com o banco de teste de verdade: fila, worker, novas tentativas, recomendação e nota mínima, validação e limites de tamanho, acesso por token, paginação, exclusão, e os erros 400, 401, 404, 409, 422 e 500.
- **Testes de integração** (`test/integration/`): a fila com uma linha travada por outra transação (prova o SKIP LOCKED), vários workers ao mesmo tempo, posse (o worker atrasado não grava), espera entre tentativas, currículo abandonado, pré-seleção com mais de 40 candidatos, o processamento de ponta a ponta e o cache de embeddings no pgvector.
- **Testes unitários** ao lado do código (`*.test.ts`): datas, resumo, ficha (inclusive que nenhum dado pessoal entra no vetor), métodos de semelhança e notas mínimas, prompt e exemplos (inclusive a marca `<curriculo>` que o texto não consegue fechar), extração e embedding pelo AI SDK, laço do worker, gerador.
- **Sem custo e sem rede**: a OpenAI é trocada por substitutos determinísticos (`test/support/fakes.ts`) e pelos modelos falsos do AI SDK (`ai/test`).
- **Cobertura de 100%** de linhas e de funções em `src/`, exigida pelo `bunfig.toml` (o `bun test --coverage` falha abaixo disso). Ficam fora só os pontos de entrada, que leem o `.env`, abrem conexões e chamam o que está testado (`src/cli/`, `src/api/server.ts`, `src/worker/index.ts`, `src/dev.ts`), e o laboratório.

## Estrutura

```
src/                        o produto
├── api/                    API em Elysia
│   ├── app.ts              monta o acesso, as rotas, o OpenAPI e o tratamento único de erros
│   ├── auth.ts             acesso por token (Authorization: Bearer)
│   ├── errors.ts           códigos de erro, status e mensagens, num lugar só
│   ├── server.ts           entrada: bun run api
│   └── features/resumes/   rotas (routes), regras das rotas (services), contrato (dtos),
│                           resposta (mappers), limites (consts) e erros
├── resumes/                o núcleo dos currículos, sem HTTP: a fila (repository), o processamento
│                           (processing) e os vetores gravados (vectors). Usado pela API e pelo worker
├── worker/                 o laço que processa a fila (entrada: bun run worker)
├── extraction/             prompt, exemplos e a chamada ao modelo (AI SDK)
├── embedding/              embedding (AI SDK) e o cache no Postgres
├── profile/                currículo → texto por seção e por emprego
├── similarity/             métodos de semelhança, notas mínimas e recomendação
├── domain/                 o formato do currículo (Zod), seções, rótulos, tempo de carreira, resumo
├── db/                     schema do Drizzle, conexão e migrações
├── lib/                    o cliente da OpenAI e as mensagens do Zod em português
├── io/                     leitura e escrita de arquivos
├── utils/                  funções puras: meses (date-fns), vetores, estatística, texto, opções de linha de comando
└── cli/                    extract, recommend, db:migrate
lab/                        o laboratório: currículos sintéticos, gabarito, métricas, benchmark,
│                           páginas de exemplo e grafo
└── history/                a primeira versão do experimento, guardada como registro
test/
├── api/                    testes das rotas
├── integration/            testes de fila, processamento e cache
└── support/                banco de teste, fábricas (Faker) e substitutos da OpenAI
samples/                    currículos em texto para testar a extração
docs/exemplos/              páginas geradas pelo laboratório
```

O `src/` não importa nada de `lab/`, e o worker não depende da API: os dois usam `src/resumes/`. As regras ficam comentadas no código, com o porquê de cada uma.

## Limitações e próximos passos

- **Currículos sintéticos.** O gabarito é uma definição nossa. O próximo passo é rotular 30 a 50 currículos reais (2 ou 3 pessoas dando nota de 0 a 3 a cada par) e medir com eles.
- **Emprego atual contra carreira inteira.** O método padrão pesa os empregos pela duração. Se o uso for achar um substituto para uma vaga, o emprego atual talvez deva pesar mais: o método `jobs-recency` existe para isso.
- **Outros modelos de embedding.** Num benchmark de pt-BR (MTEB-BR, 2026), `gemini-embedding-001` e Qwen3-Embedding 4B e 8B ficaram um pouco acima do `text-embedding-3-large`. Vale medir no nosso gabarito.
- **Reordenar os melhores** com um modelo de linguagem como juiz (os 10 primeiros, numa chamada) pode corrigir casos pontuais.
- **Taxonomia.** Mapear cargo e habilidade para a ESCO (que tem português) deixaria a padronização menos dependente do prompt.
- **Acesso.** Um token só, para quem chama a API. Contas de usuário, permissões e trilha de auditoria ficam para quem integrar.
- **Viés.** O nome fica fora do vetor, mas instituição de ensino, cidade e gênero do cargo ainda entram. Antes de usar com gente de verdade, vale um teste contrafactual (trocar só um desses campos e ver se a recomendação muda). E, se o sistema filtrar candidatos sozinho, o artigo 20 da LGPD (revisão de decisão automatizada) pode se aplicar.

## Referências

- ColBERT e MaxSim: [Khattab e Zaharia, 2020](https://arxiv.org/abs/2004.12832).
- RRF contra combinação de notas: [Bruch, Gai e Ingber, 2022](https://arxiv.org/abs/2210.11934).
- Casamento de currículo e vaga com embeddings: [ConFit v2, 2025](https://arxiv.org/abs/2502.12361).
- pgvector, limites de dimensão, `halfvec` e `ef_search`: [README do pgvector](https://github.com/pgvector/pgvector).
- Benchmarks de embedding em português: [MTEB-BR](https://arxiv.org/abs/2607.04581).
- Viés em embeddings de currículos: [Wilson e Caliskan, 2024](https://arxiv.org/abs/2407.20371).
