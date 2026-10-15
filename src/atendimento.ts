/**
 * Recebe uma mensagem do WhatsApp, entende (transcreve áudio, guarda foto/PDF),
 * chama a Paloma e responde em texto ou áudio.
 * Mensagens da mesma pessoa são processadas uma por vez, na ordem.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { q, um } from "./db.js";
import { config } from "./config.js";
import { pensar, descreverArquivo } from "./agente/cerebro.js";
import type { Usuario } from "./agente/permissoes.js";
import * as wa from "./whatsapp/uazapi.js";
import { falar, transcrever, vozLigada } from "./voz/elevenlabs.js";

const filas = new Map<string, Promise<void>>();

export function enfileirar(m: wa.Recebida) {
  const anterior = filas.get(m.telefone) ?? Promise.resolve();
  const proxima = anterior.then(() => atender(m)).catch((e) => console.error("atendimento", m.telefone, e));
  filas.set(m.telefone, proxima);
  proxima.finally(() => { if (filas.get(m.telefone) === proxima) filas.delete(m.telefone); });
}

const ultimos8 = (t: string) => t.replace(/\D/g, "").slice(-8);

async function quemE(telefone: string): Promise<Usuario | null> {
  // compara os 8 últimos dígitos por causa do 9º dígito
  return um<Usuario>(`select * from paloma.usuarios where ativo and right(telefone, 8) = $1 limit 1`, [ultimos8(telefone)]);
}

async function registrar(telefone: string, usuarioId: string | null, papel: "user" | "assistant", texto: string, waId: string | null, arquivoId: string | null = null) {
  await q(`insert into paloma.mensagens (telefone, usuario_id, papel, texto, wa_id, arquivo_id) values ($1,$2,$3,$4,$5,$6) on conflict (wa_id) do nothing`,
    [telefone, usuarioId, papel, texto, waId, arquivoId]);
}

async function atender(m: wa.Recebida) {
  const inicioTurno = new Date();
  if (m.id && (await um(`select 1 from paloma.mensagens where wa_id=$1`, [m.id]))) return; // webhook repetido

  const u = await quemE(m.telefone);
  if (!u) {
    const jaAvisou = await um(`select 1 from paloma.mensagens where telefone=$1 and papel='assistant' and criado_em > now() - interval '1 day'`, [m.telefone]);
    await registrar(m.telefone, null, "user", m.texto || `[${m.tipo}]`, m.id);
    if (!jaAvisou) {
      const txt = "Oi! Aqui é a Paloma, assistente da equipe JRPV Brasil. 💚\nEste número atende só a equipe interna. Se você faz parte do time, peça para a gerência liberar seu acesso.";
      const id = await wa.enviarTexto(m.telefone, txt);
      await registrar(m.telefone, null, "assistant", txt, id);
    }
    return;
  }

  await wa.digitando(m.telefone);
  const blocos: Anthropic.ContentBlockParam[] = [];
  let texto = m.texto || "";
  let veioAudio = false;
  let arquivoId: string | null = null;

  if (m.tipo !== "texto" && m.id) {
    const midia = await wa.baixarMidia(m.id).catch((e) => { console.error("mídia", e); return null; });
    if (!midia) {
      texto = `${texto}\n[a pessoa mandou ${m.tipo}, mas não consegui baixar o arquivo]`.trim();
    } else if (m.tipo === "audio") {
      veioAudio = true;
      const transcrito = await transcrever(midia.base64, midia.mime).catch((e) => { console.error("transcrição", e); return ""; });
      texto = transcrito ? `[áudio] ${transcrito}` : "[a pessoa mandou um áudio, mas não consegui transcrever]";
    } else {
      const bruto = Buffer.from(midia.base64, "base64");
      const [a] = await q<{ id: string }>(
        `insert into paloma.arquivos (usuario_id, telefone, wa_id, mime, nome, tamanho, conteudo) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [u.id, m.telefone, m.id, midia.mime, m.nomeArquivo, bruto.length, bruto]);
      arquivoId = a.id;
      const bloco: Anthropic.ContentBlockParam | null =
        midia.mime === "application/pdf" ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: midia.base64 } } :
        /^image\/(jpeg|png|gif|webp)$/.test(midia.mime) ? { type: "image", source: { type: "base64", media_type: midia.mime as any, data: midia.base64 } } : null;
      if (bloco) {
        blocos.push(bloco);
        descreverArquivo(bloco).then((d) => q(`update paloma.arquivos set descricao=$2 where id=$1`, [a.id, d])).catch(() => {});
      }
      texto = `${texto}\n[arquivo recebido: ${m.tipo}${m.nomeArquivo ? ` "${m.nomeArquivo}"` : ""}, arquivo_id ${a.id}${bloco ? "" : `, formato ${midia.mime} que você não consegue abrir`}]`.trim();
    }
  }
  if (m.citada) texto = `[respondendo a: "${m.citada.slice(0, 300)}"]\n${texto}`;
  if (!texto && !blocos.length) return;

  await registrar(m.telefone, u.id, "user", texto, m.id, arquivoId);
  blocos.push({ type: "text", text: texto || "(sem texto)" });

  let resposta: string;
  try {
    resposta = await pensar({ usuario: u, conteudo: blocos, inicioTurno });
  } catch (e) {
    console.error("pensar", e);
    resposta = "Vixe, deu um problema aqui do meu lado e não consegui terminar. Tenta de novo daqui a pouquinho? Se continuar, avisa a gerência.";
  }

  const modoVoz = String(u.preferencias?.voz || "auto");
  const emAudio = vozLigada() && (modoVoz === "sempre" || (modoVoz === "auto" && veioAudio)) && resposta.length < 1800;
  let waId: string | null = null;
  if (emAudio) {
    try {
      await wa.digitando(m.telefone, "recording");
      waId = await wa.enviarAudio(m.telefone, await falar(resposta));
      // dado que precisa ser copiado (placa, código, link) vai também por escrito
      if (/\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b|\d{6,}|https?:\/\//.test(resposta)) await wa.enviarTexto(m.telefone, resposta);
    } catch (e) {
      console.error("voz", e);
      waId = await wa.enviarTexto(m.telefone, resposta);
    }
  } else {
    waId = await wa.enviarTexto(m.telefone, resposta);
  }
  await registrar(m.telefone, u.id, "assistant", resposta, waId);
}

/** Garante que o administrador definido no ambiente exista. */
export async function garantirAdmin() {
  if (!config.adminTelefone) return;
  await q(`insert into paloma.usuarios (nome, telefone, papel) values ('Administrador', $1, 'admin') on conflict (telefone) do nothing`, [config.adminTelefone.replace(/\D/g, "")]);
}
