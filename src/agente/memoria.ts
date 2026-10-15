// Memória da Paloma: da JRPV (vale para todos) e de cada pessoa (só para ela).
import { q } from "../db.js";
import type { Usuario } from "./permissoes.js";

export type Memoria = { id: number; escopo: "jrpv" | "pessoa"; tipo: string; texto: string; atualizado_em: string };

export async function lembrar(u: Usuario, escopo: "jrpv" | "pessoa", tipo: string, texto: string, origem = "conversa") {
  const limpo = texto.trim().slice(0, 1500);
  // evita duplicar a mesma memória
  const parecida = await q<{ id: number }>(
    `select id from paloma.memorias where ativo and escopo=$1 and coalesce(usuario_id::text,'')=coalesce($2::text,'')
       and lower(regexp_replace(texto,'\\W','','g')) = lower(regexp_replace($3,'\\W','','g')) limit 1`,
    [escopo, escopo === "pessoa" ? u.id : null, limpo],
  );
  if (parecida.length) {
    await q(`update paloma.memorias set texto=$2, tipo=$3, atualizado_em=now() where id=$1`, [parecida[0].id, limpo, tipo]);
    return { id: parecida[0].id, atualizada: true };
  }
  const [m] = await q<{ id: number }>(
    `insert into paloma.memorias (escopo, usuario_id, tipo, texto, origem, criado_por) values ($1,$2,$3,$4,$5,$6) returning id`,
    [escopo, escopo === "pessoa" ? u.id : null, tipo, limpo, origem, u.id],
  );
  return { id: m.id, atualizada: false };
}

export async function buscar(u: Usuario, termo: string, limite = 8): Promise<Memoria[]> {
  return q<Memoria>(
    `select id, escopo, tipo, texto, atualizado_em from paloma.memorias
      where ativo and (escopo='jrpv' or usuario_id=$1)
        and (busca @@ websearch_to_tsquery('portuguese', $2) or texto ilike '%' || $2 || '%')
      order by ts_rank(busca, websearch_to_tsquery('portuguese', $2)) desc, atualizado_em desc
      limit $3`,
    [u.id, termo, limite],
  );
}

export async function esquecer(u: Usuario, id: number, podeJrpv: boolean) {
  const r = await q(
    `update paloma.memorias set ativo=false, atualizado_em=now()
      where id=$1 and (usuario_id=$2 or ($3 and escopo='jrpv')) returning id`,
    [id, u.id, podeJrpv],
  );
  return r.length > 0;
}

/** O que a Paloma sempre carrega: preferências e casos da pessoa + as regras mais recentes da casa. */
export async function contexto(u: Usuario): Promise<string> {
  const pessoais = await q<Memoria>(
    `select id, escopo, tipo, texto, atualizado_em from paloma.memorias where ativo and usuario_id=$1 order by atualizado_em desc limit 15`, [u.id]);
  const casa = await q<Memoria>(
    `select id, escopo, tipo, texto, atualizado_em from paloma.memorias where ativo and escopo='jrpv' and tipo in ('regra','procedimento')
      order by atualizado_em desc limit 25`);
  const linhas: string[] = [];
  if (casa.length) linhas.push("Regras e procedimentos da JRPV que você já aprendeu:", ...casa.map((m) => `- [#${m.id}] ${m.texto}`));
  if (pessoais.length) linhas.push("", `O que você lembra de ${u.apelido || u.nome}:`, ...pessoais.map((m) => `- [#${m.id}] (${m.tipo}) ${m.texto}`));
  return linhas.join("\n");
}
