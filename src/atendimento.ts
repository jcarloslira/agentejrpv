/**
 * Recebe mensagens do WhatsApp, entende (transcreve áudio, guarda foto/PDF),
 * chama a Paloma e responde em texto ou áudio.
 *
 * Gente no WhatsApp manda em rajada ("segue a CNH" + PDF + "já mando o CRLV").
 * Por isso as mensagens de cada pessoa esperam alguns segundos de silêncio e são
 * respondidas JUNTAS, numa resposta só. Uma pessoa por vez, na ordem.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { q, um } from "./db.js";
import { config } from "./config.js";
import { pensar, descreverArquivo } from "./agente/cerebro.js";
import type { Usuario } from "./agente/permissoes.js";
import * as wa from "./whatsapp/uazapi.js";
import { falar, transcrever, vozLigada } from "./voz/elevenlabs.js";

const ESPERA_TEXTO_MS = 3500;   // silêncio que fecha a rajada
const ESPERA_MIDIA_MS = 6000;   // depois de arquivo/áudio costuma vir legenda ou outro arquivo
const AVISO_DEMORA_MS = 25000;  // se o raciocínio passar disso, avisa que está trabalhando

type Pendente = { msgs: wa.Recebida[]; timer: NodeJS.Timeout | null };
const pendentes = new Map<string, Pendente>();
const filas = new Map<string, Promise<void>>();

export function enfileirar(m: wa.Recebida) {
  const p = pendentes.get(m.telefone) ?? { msgs: [], timer: null };
  if (m.id && p.msgs.some((x) => x.id === m.id)) return; // webhook repetido
  p.msgs.push(m);
  if (p.timer) clearTimeout(p.timer);
  p.timer = setTimeout(() => despachar(m.telefone), m.tipo === "texto" ? ESPERA_TEXTO_MS : ESPERA_MIDIA_MS);
  pendentes.set(m.telefone, p);
}

function despachar(telefone: string) {
  const p = pendentes.get(telefone);
  pendentes.delete(telefone);
  if (!p?.msgs.length) return;
  const anterior = filas.get(telefone) ?? Promise.resolve();
  const proxima = anterior.then(() => atender(telefone, p.msgs)).catch((e) => console.error("atendimento", telefone, e));
  filas.set(telefone, proxima);
  proxima.finally(() => { if (filas.get(telefone) === proxima) filas.delete(telefone); });
}

/** DDD + 8 últimos dígitos: o WhatsApp às vezes entrega o número sem o 9º dígito. */
export function chaveTelefone(t: string): string {
  let d = String(t || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : d;
}

async function quemE(telefone: string): Promise<Usuario | null> {
  const ativos = await q<Usuario>(`select * from paloma.usuarios where ativo and right(telefone, 8) = right($1, 8)`, [telefone.replace(/\D/g, "")]);
  return ativos.find((u) => chaveTelefone(u.telefone) === chaveTelefone(telefone)) ?? null;
}

async function registrar(telefone: string, usuarioId: string | null, papel: "user" | "assistant", texto: string, waId: string | null, arquivoId: string | null = null) {
  await q(`insert into paloma.mensagens (telefone, usuario_id, papel, texto, wa_id, arquivo_id) values ($1,$2,$3,$4,$5,$6) on conflict (wa_id) do nothing`,
    [telefone, usuarioId, papel, texto, waId, arquivoId]);
}

/** Baixa e prepara uma mensagem: devolve o texto para o histórico e os blocos para a Paloma ver. */
async function preparar(u: Usuario, m: wa.Recebida): Promise<{ texto: string; blocos: Anthropic.ContentBlockParam[]; audio: boolean; arquivoId: string | null }> {
  const blocos: Anthropic.ContentBlockParam[] = [];
  let texto = m.texto || "";
  let audio = false;
  let arquivoId: string | null = null;

  if (m.tipo !== "texto" && m.id) {
    const midia = await wa.baixarMidia(m.id).catch((e) => { console.error("mídia", e); return null; });
    if (!midia) {
      texto = `${texto}\n[a pessoa mandou ${m.tipo}, mas não consegui baixar o arquivo]`.trim();
    } else if (m.tipo === "audio") {
      audio = true;
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
        // a descrição fica guardada no histórico: nas próximas conversas a Paloma lembra o que era o arquivo
        descreverArquivo(bloco)
          .then(async (d) => {
            await q(`update paloma.arquivos set descricao=$2 where id=$1`, [a.id, d]);
            await q(`update paloma.mensagens set texto = texto || $2 where arquivo_id=$1`, [a.id, `\n[conteúdo do arquivo: ${d}]`]);
          })
          .catch(() => {});
      }
      texto = `${texto}\n[arquivo recebido: ${m.tipo}${m.nomeArquivo ? ` "${m.nomeArquivo}"` : ""}, arquivo_id ${a.id}${bloco ? "" : `, formato ${midia.mime} que você não consegue abrir`}]`.trim();
    }
  }
  if (m.citada) texto = `[respondendo a: "${m.citada.slice(0, 300)}"]\n${texto}`;
  return { texto, blocos, audio, arquivoId };
}

async function atender(telefone: string, lote: wa.Recebida[]) {
  const inicioTurno = new Date();
  const ids = lote.map((m) => m.id).filter(Boolean);
  const jaVistas = new Set((await q<{ wa_id: string }>(`select wa_id from paloma.mensagens where wa_id = any($1)`, [ids])).map((r) => r.wa_id));
  const novas = lote.filter((m) => !m.id || !jaVistas.has(m.id));
  if (!novas.length) return;

  // Silêncio total para quem não está cadastrado: o número pode ser comercial e receber
  // mensagem de clientes. Não responde, não mostra "digitando", não grava a mensagem.
  const u = await quemE(telefone);
  if (!u) return;

  // "digitando…" enquanto ela trabalha (o WhatsApp apaga o indicador depois de alguns segundos)
  await wa.digitando(telefone);
  const presenca = setInterval(() => wa.digitando(telefone), 8000);
  const avisoDemora = setTimeout(async () => {
    const txt = "Tô puxando aqui nos sistemas, só um instante 🙏";
    const id = await wa.enviarTexto(telefone, txt).catch(() => null);
    await registrar(telefone, u.id, "assistant", txt, id).catch(() => {});
  }, AVISO_DEMORA_MS);

  try {
    const blocos: Anthropic.ContentBlockParam[] = [];
    let veioAudio = false;
    const textos: string[] = [];
    for (const m of novas) {
      const p = await preparar(u, m);
      if (!p.texto && !p.blocos.length) continue;
      await registrar(telefone, u.id, "user", p.texto || "(sem texto)", m.id, p.arquivoId);
      blocos.push(...p.blocos);
      textos.push(p.texto);
      veioAudio ||= p.audio;
    }
    if (!textos.length) return;
    const juntas = textos.length > 1 ? `[${textos.length} mensagens seguidas]\n${textos.map((t) => `• ${t}`).join("\n")}` : textos[0];
    blocos.push({ type: "text", text: juntas });

    let resposta: string;
    try {
      resposta = await pensar({ usuario: u, conteudo: blocos, inicioTurno });
    } catch (e) {
      console.error("pensar", e);
      resposta = "Vixe, deu um problema aqui do meu lado e não consegui terminar. Tenta de novo daqui a pouquinho? Se continuar, avisa a gerência.";
    }
    clearTimeout(avisoDemora);
    clearInterval(presenca);
    await responder(u, telefone, resposta, veioAudio);
  } finally {
    clearTimeout(avisoDemora);
    clearInterval(presenca);
  }
}

async function responder(u: Usuario, telefone: string, resposta: string, veioAudio: boolean) {
  const modoVoz = String(u.preferencias?.voz || "auto");
  const emAudio = (await vozLigada()) && (modoVoz === "sempre" || (modoVoz === "auto" && veioAudio)) && resposta.length < 1800;
  let waId: string | null = null;
  if (emAudio) {
    try {
      await wa.digitando(telefone, "recording");
      waId = await wa.enviarAudio(telefone, await falar(resposta));
      // dado que precisa ser copiado (placa, código, link) vai também por escrito
      if (/\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b|\d{6,}|https?:\/\//.test(resposta)) await wa.enviarTexto(telefone, resposta);
    } catch (e) {
      console.error("voz", e);
      waId = await wa.enviarTexto(telefone, resposta);
    }
  } else {
    waId = await wa.enviarTexto(telefone, resposta);
  }
  await registrar(telefone, u.id, "assistant", resposta, waId);
}

/** Mensagem que a Paloma manda por iniciativa própria (resumo do dia, alerta). */
export async function mandarPorConta(u: Usuario, texto: string) {
  const id = await wa.enviarTexto(u.telefone, texto);
  await q(`insert into paloma.mensagens (telefone, usuario_id, papel, texto, wa_id) values ($1,$2,'aviso',$3,$4)`, [u.telefone, u.id, texto, id]);
}

/** Garante que o administrador definido no ambiente exista. */
export async function garantirAdmin() {
  if (!config.adminTelefone) return;
  await q(`insert into paloma.usuarios (nome, telefone, papel) values ('Administrador', $1, 'admin') on conflict (telefone) do nothing`, [config.adminTelefone.replace(/\D/g, "")]);
}
