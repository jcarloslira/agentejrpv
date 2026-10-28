/**
 * uazapi: a instância do WhatsApp da Paloma.
 * Cabeçalho `token` = token da instância; `admintoken` = token do servidor (criar instâncias).
 */
import { config } from "../config.js";
import { q, um } from "../db.js";

async function uaz(caminho: string, metodo = "GET", corpo?: unknown, admin = false, tokenInstancia?: string): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (admin) headers.admintoken = config.uazapiAdminToken;
  else headers.token = tokenInstancia || (await tokenDaInstancia());
  const r = await fetch(config.uazapiUrl + caminho, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const txt = await r.text();
  let j: any = {};
  try { j = txt ? JSON.parse(txt) : {}; } catch { j = { texto: txt }; }
  if (!r.ok) throw new Error(j.error || j.message || `uazapi respondeu ${r.status} em ${caminho}`);
  return j;
}

/** Token da instância: do ambiente ou o que a própria Paloma criou e guardou. */
export async function tokenDaInstancia(): Promise<string> {
  if (config.uazapiInstanciaToken) return config.uazapiInstanciaToken;
  const c = await um<{ valor: any }>(`select valor from paloma.config where chave='uazapi_instancia'`);
  if (!c?.valor?.token) throw new Error("A instância do WhatsApp da Paloma ainda não foi criada (POST /admin/whatsapp/conectar).");
  return c.valor.token;
}

/** Lista as instâncias do servidor (para escolher um dos números contratados). */
export async function listarInstancias() {
  return uaz("/instance/all", "GET", undefined, true);
}

/** Cria (se preciso) a instância da Paloma, aponta o webhook e devolve o QR Code. */
export async function conectar(urlWebhook: string, nome = "Paloma · JRPV"): Promise<{ conectado: boolean; numero: string | null; qrcode: string | null }> {
  let tk: string | null = null;
  try { tk = await tokenDaInstancia(); } catch { tk = null; }
  if (!tk) {
    // versões da uazapi diferem no nome da rota de criação
    const criada = await uaz("/instance/init", "POST", { name: nome, systemName: "paloma" }, true)
      .catch(() => uaz("/instance/create", "POST", { name: nome }, true));
    tk = String(criada.token || criada.instance?.token || "");
    if (!tk) throw new Error("A uazapi não devolveu o token da instância nova.");
    await q(`insert into paloma.config (chave, valor) values ('uazapi_instancia', $1)
             on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()`,
      [{ token: tk, id: criada.instance?.id || criada.id || null, nome }]);
  }
  await uaz("/webhook", "POST", {
    enabled: true, url: urlWebhook, events: ["messages", "connection"],
    excludeMessages: ["wasSentByApi", "isGroupYes"],
  }, false, tk);
  let st = await uaz("/instance/status", "GET", undefined, false, tk);
  if (!st.status?.connected && !st.instance?.qrcode) {
    await uaz("/instance/connect", "POST", {}, false, tk);
    st = await uaz("/instance/status", "GET", undefined, false, tk);
  }
  return { conectado: !!st.status?.connected, numero: st.status?.jid?.user || null, qrcode: st.status?.connected ? null : st.instance?.qrcode || null };
}

export async function status() {
  const st = await uaz("/instance/status");
  const jid = st.status?.jid;
  const numero = (typeof jid === "string" ? jid.split(/[:@]/)[0] : jid?.user) || st.instance?.owner || null;
  return { conectado: !!st.status?.connected, numero, perfil: st.instance?.profileName || null };
}

export async function digitando(numero: string, tipo: "composing" | "recording" = "composing") {
  await uaz("/message/presence", "POST", { number: numero, presence: tipo, delay: 4000 }).catch(() => {});
}

/** Marca como lidas (os dois tracinhos azuis), como uma pessoa que abriu a conversa. */
export async function marcarLidas(ids: string[]) {
  if (!ids.length) return;
  await uaz("/message/markread", "POST", { id: ids }).catch(() => {});
}

export async function enviarTexto(numero: string, texto: string): Promise<string | null> {
  const r = await uaz("/send/text", "POST", { number: numero, text: texto, linkPreview: false });
  return r.messageid || r.id || null;
}

/** Áudio como mensagem de voz (ptt). `arquivo` = base64 (sem prefixo) ou URL. */
export async function enviarAudio(numero: string, base64Mp3: string): Promise<string | null> {
  const r = await uaz("/send/media", "POST", { number: numero, type: "ptt", file: `data:audio/mpeg;base64,${base64Mp3}` });
  return r.messageid || r.id || null;
}

export async function enviarDocumento(numero: string, base64: string, mime: string, nome: string, legenda = ""): Promise<string | null> {
  const tipo = mime.startsWith("image/") ? "image" : "document";
  const r = await uaz("/send/media", "POST", { number: numero, type: tipo, file: `data:${mime};base64,${base64}`, docName: nome, text: legenda });
  return r.messageid || r.id || null;
}

/** Baixa a mídia de uma mensagem recebida. */
export async function baixarMidia(messageId: string): Promise<{ base64: string; mime: string } | null> {
  const d = await uaz("/message/download", "POST", { id: messageId, return_base64: true, return_link: false, generate_mp3: true });
  const b64 = String(d.base64Data || d.base64 || d.data || "").replace(/^data:[^,]+,/, "");
  if (!b64) return null;
  return { base64: b64, mime: d.mimetype || d.mimeType || "application/octet-stream" };
}

// ---------- mensagem recebida (webhook) ----------

export type Recebida = {
  id: string;
  telefone: string;
  nome: string | null;
  texto: string;
  tipo: "texto" | "audio" | "imagem" | "documento" | "video" | "outro";
  nomeArquivo: string | null;
  citada: string | null; // texto da mensagem respondida (reply)
  citadaId: string | null; // id da mensagem respondida, para achar a mensagem inteira no histórico
  bruto: unknown; // payload original (guardado só para quem é da equipe)
};

const digitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

export function lerWebhook(b: any): Recebida | null {
  if (b?.EventType !== "messages") return null;
  const msg = b.message || {};
  const chat = b.chat || {};
  const chatid = String(msg.chatid || "");
  if (msg.fromMe || msg.wasSentByApi || msg.isGroup || /@g\.us|@newsletter|@broadcast/.test(chatid)) return null;
  const telefone = digitos(chat.phone || (chatid.endsWith("@s.whatsapp.net") ? chatid.split("@")[0] : String(msg.sender_pn || "").split("@")[0]));
  if (!telefone) return null;
  const t = String(msg.messageType || "").toLowerCase();
  const tipo: Recebida["tipo"] =
    /audio|ptt/.test(t) ? "audio" : /image|sticker/.test(t) ? "imagem" : /document/.test(t) ? "documento" : /video/.test(t) ? "video" :
    /conversation|extendedtext|text/.test(t) || !t ? "texto" : "outro";
  const conteudo = typeof msg.content === "object" && msg.content ? msg.content : {};
  return {
    id: String(msg.messageid || msg.id || ""),
    telefone,
    nome: msg.senderName || chat.name || chat.wa_contactName || null,
    texto: typeof msg.text === "string" ? msg.text : (conteudo.caption || ""),
    tipo,
    nomeArquivo: conteudo.fileName || conteudo.title || null,
    citada: (typeof msg.quoted === "object" ? msg.quoted?.text : null) || conteudo.contextInfo?.quotedMessage?.conversation
      || conteudo.contextInfo?.quotedMessage?.extendedTextMessage?.text || null,
    citadaId: (typeof msg.quoted === "string" && msg.quoted ? msg.quoted : null) || msg.quoted?.messageid || msg.quoted?.id
      || conteudo.contextInfo?.stanzaID || conteudo.contextInfo?.stanzaId || null,
    bruto: b,
  };
}
