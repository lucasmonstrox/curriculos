# Histórico

A primeira versão do experimento, guardada como registro de como se chegou ao desenho atual. Nada aqui é mantido nem roda com o código de hoje.

- `gerar.ts` e `recomendar.ts`: os scripts da primeira rodada (currículos escritos à mão, depois sorteados com ruído).
- `candidatos.json`, `gabarito.json`, `fichas/`, `recomendacoes.txt`: a última saída deles.
- `resultados*.jsonl`: as medições de cada rodada (ficha com mais e menos seções, vetor por seção, vetor por emprego, resumo antigo contra o novo).

O cache de embeddings daquela versão (`embeddings-cache.json`, 215 MB) fica só na máquina de quem rodou, fora do git.
