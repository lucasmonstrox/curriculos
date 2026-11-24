/*
 * Desenvolvimento: API e worker no mesmo processo (`bun run dev`), para subir tudo com um comando.
 * Em produção, rode `bun run api` e `bun run worker` separados (e quantos workers quiser).
 */
import "./api/server";
import "./worker";
