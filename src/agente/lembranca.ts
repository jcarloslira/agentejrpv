/**
 * Memória de longo prazo da Paloma.
 *
 * 1. Janela recente: as últimas mensagens entram inteiras no contexto (cerebro.ts).
 * 2. Resumo corrido: o que ficou fora da janela vira um resumo por pessoa, atualizado
 *    sozinho (quem é, o que já se tratou, casos em aberto, combinados).
 * 3. Busca: qualquer mensagem antiga pode ser achada por palavra ou data (buscar_conversas).
 * 4. Anotações automáticas: depois de cada conversa, o que importa para depois
 *    (promessas dela, pendências, preferências, casos) vira memória da pessoa.
 */
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { q, um } from "../db.js";
import type { Usuario } from "./permissoes.js";
import * as memoria from "./memoria.js";

const client = new Anthropic({ apiKey: config.anthropicKey });

/** Quantas mensagens recentes vão inteiras para o contexto. */
export const JANELA = 40;

const quando = (d: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: config.fuso, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(d));

export async function resumoDaPessoa(usuarioId: string): Promise<string> {
  const r = await um<{ texto: string; ate: string }>(`select texto, ate from paloma.resumos where usuario_id=$1`, [usuarioId]);
  return r ? `Resumo do que você já conversou com esta pessoa antes das mensagens recentes (até ${quando(r.ate)}):\n${r.texto}` : "";
}

/** Atualiza o resumo com as mensagens que saíram da janela recente. */
export async function atualizarResumo(u: Usuario) {
  const corte = await um<{ criado_em: string }>(
    `select criado_em from paloma.mensagens where usuario_id=$1 order by criado_em desc offset $2 limit 1`, [u.id, JANELA - 1]);
  if (!corte) return; // a conversa inteira ainda cabe na janela
  const atual = await um<{ texto: string; ate: string }>(`select texto, ate from paloma.resumos where usuario_id=$1`, [u.id]);
  const novas = await q<{ papel: string; texto: string; criado_em: string }>(
    `select papel, texto, criado_em from paloma.mensagens where usuario_id=$1 and criado_em < $2 and criado_em > coalesce($3::timestamptz, '-infinity')
      order by criado_em limit 200`, [u.id, corte.criado_em, atual?.ate ?? null]);
  if (novas.length < 6) return; // espera juntar um pouco antes de gastar
  const trecho = novas.map((m) => `[${quando(m.criado_em)}] ${m.papel === "user" ? u.apelido || u.nome : "Paloma"}: ${m.texto}`).join("\n").slice(0, 60000);
  const r = await client.messages.create({
    model: config.modeloRapido,
    max_tokens: 1500,
    system: "Você mantém o resumo de longo prazo das conversas de WhatsApp entre a Paloma (assistente da JRPV Proteção Veicular) e uma pessoa da equipe. Escreva em português, em tópicos curtos, só o que serve para a Paloma continuar o relacionamento sem esquecer nada importante.",
    messages: [{
      role: "user",
      content: `Resumo atual:\n${atual?.texto || "(vazio)"}\n\nNovas mensagens para incorporar:\n${trecho}\n\nDevolva o resumo ATUALIZADO completo (máximo ~350 palavras), com as seções: Quem é e como gosta de ser atendido; O que já foi feito (com datas, placas, códigos de cotação, números citados); Em aberto (pendências, promessas da Paloma, perguntas sem resposta); Combinados e regras que a pessoa definiu. Remova o que já foi resolvido há muito tempo e não importa mais.`,
    }],
  });
  const texto = r.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n").trim();
  if (!texto) return;
  const ate = novas[novas.length - 1].criado_em;
  await q(`insert into paloma.resumos (usuario_id, texto, ate) values ($1,$2,$3)
           on conflict (usuario_id) do update set texto=excluded.texto, ate=excluded.ate, atualizado_em=now()`, [u.id, texto, ate]);
}

/** Procura em toda a conversa com a pessoa (ou de todos, para gerência+). */
export async function buscarConversas(u: Usuario, termo: string, de?: string, ate?: string, todos = false, limite = 15) {
  const params: unknown[] = [termo || "", de || null, ate || null, limite];
  let filtro = "";
  if (!todos) { params.push(u.id); filtro = `and m.usuario_id = $${params.length}`; }
  return q(
    `select to_char(m.criado_em at time zone 'America/Maceio','DD/MM/YYYY HH24:MI') quando, coalesce(us.apelido, us.nome) pessoa,
            case m.papel when 'user' then 'pessoa' else 'Paloma' end quem, left(m.texto, 900) texto
       from paloma.mensagens m left join paloma.usuarios us on us.id = m.usuario_id
      where ($1 = '' or m.busca @@ websearch_to_tsquery('portuguese', $1) or m.texto ilike '%' || $1 || '%')
        and ($2::date is null or (m.criado_em at time zone 'America/Maceio')::date >= $2::date)
        and ($3::date is null or (m.criado_em at time zone 'America/Maceio')::date <= $3::date)
        ${filtro}
      order by m.criado_em desc limit $4`, params);
}

/** Acha a mensagem que a pessoa marcou ao responder: pelo id do WhatsApp ou, sem ele, pelo começo do texto. */
export async function mensagemCitada(u: Usuario, citadaId: string | null, citadaTexto: string | null) {
  if (citadaId) {
    const m = await um<{ papel: string; texto: string; criado_em: string }>(
      `select papel, texto, criado_em from paloma.mensagens where wa_id=$1 and usuario_id=$2`, [citadaId, u.id]);
    if (m) return m;
  }
  if (citadaTexto && citadaTexto.trim().length >= 8) {
    return um<{ papel: string; texto: string; criado_em: string }>(
      `select papel, texto, criado_em from paloma.mensagens where usuario_id=$1 and position($2 in texto) > 0
        order by criado_em desc limit 1`, [u.id, citadaTexto.trim().slice(0, 120)]);
  }
  return null;
}

export function descreverCitacao(u: Usuario, m: { papel: string; texto: string; criado_em: string } | null, citadaTexto: string | null) {
  if (m) {
    const autor = m.papel === "user" ? "a própria pessoa" : "VOCÊ (Paloma)";
    return `[A pessoa está RESPONDENDO, marcando uma mensagem que ${autor} enviou em ${quando(m.criado_em)}. A mensagem marcada, na íntegra:\n"""${m.texto.slice(0, 3000)}"""\nResponda no contexto DESSA mensagem.]`;
  }
  return citadaTexto ? `[A pessoa está respondendo marcando esta mensagem: """${citadaTexto.slice(0, 1500)}"""]` : "";
}

/**
 * Depois da conversa: anota o que vale lembrar (sem repetir o que já está nas memórias).
 * Roda em segundo plano com o modelo rápido; nunca atrasa a resposta.
 */
export async function anotarDepois(u: Usuario, mensagemDaPessoa: string, respostaDaPaloma: string) {
  if ((mensagemDaPessoa + respostaDaPaloma).length < 60) return;
  const ja = await q<{ id: number; tipo: string; texto: string }>(
    `select id, tipo, texto from paloma.memorias where ativo and usuario_id=$1 order by atualizado_em desc limit 40`, [u.id]);
  const r = await client.messages.create({
    model: config.modeloRapido,
    max_tokens: 600,
    system: "Você decide o que a Paloma (assistente da JRPV) deve guardar na memória sobre uma pessoa da equipe depois de uma troca de mensagens. Seja seletivo: só o que será útil daqui a dias ou semanas.",
    messages: [{
      role: "user",
      content: `Pessoa: ${u.nome} (${u.papel})
Memórias que já existem (não repita):
${ja.map((m) => `#${m.id} (${m.tipo}) ${m.texto}`).join("\n") || "(nenhuma)"}

Mensagem da pessoa:
${mensagemDaPessoa.slice(0, 4000)}

Resposta da Paloma:
${respostaDaPaloma.slice(0, 4000)}

Responda SOMENTE um JSON: {"novas":[{"tipo":"preferencia|caso|pendencia|fato","texto":"..."}],"resolvidas":[ids de memórias de pendência que esta troca resolveu]}
- pendencia: algo que a Paloma prometeu fazer/conferir, ou que a pessoa ficou de mandar (com placa/código/nome).
- caso: atendimento em andamento (cotação X do cliente Y, placa Z) e em que pé está.
- preferencia: jeito de trabalhar/receber informação que a pessoa pediu.
- fato: algo estável sobre a pessoa (função, regional, carteira).
Nada de CPF completo, senha ou dado bancário. Se nada valer a pena, devolva listas vazias.`,
    }],
  });
  let j: any;
  try { j = JSON.parse(r.content.filter((b) => b.type === "text").map((b: any) => b.text).join("").replace(/^[^{]*/, "").replace(/[^}]*$/, "")); }
  catch { return; }
  for (const n of (j.novas || []).slice(0, 4)) {
    if (n?.texto && ["preferencia", "caso", "pendencia", "fato"].includes(n.tipo)) await memoria.lembrar(u, "pessoa", n.tipo, n.texto, "automático");
  }
  for (const id of (j.resolvidas || []).slice(0, 10)) {
    if (Number.isInteger(id)) await q(`update paloma.memorias set ativo=false, atualizado_em=now() where id=$1 and usuario_id=$2 and tipo='pendencia'`, [id, u.id]);
  }
}
