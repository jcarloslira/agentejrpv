/**
 * Roteamento da demonstração da TAIPNEUS dentro do número da Paloma.
 *
 * Só os números liberados (DEMO_PNEUS_TELEFONES ou "#pneus" mandado por um admin) falam com a
 * atendente de pneus; o resto do número continua exatamente como antes (Paloma para a equipe,
 * silêncio para quem não é cadastrado).
 *
 * Regras do Lucas (29/10 e 03/11/2026):
 *  - transferência silenciosa: o vendedor recebe o resumo e a IA para de responder aquele cliente;
 *  - reengajamento 10 min → 40 min → 3h40 (a partir da última mensagem do cliente), no máximo 3;
 *    6h40 sem resposta = Não Responsivo: encerra e grava o resumo; nunca marca venda perdida;
 *  - cliente que volta depois do Não Responsivo é atendido de novo pela IA.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { q, um } from "../db.js";
import { config } from "../config.js";
import * as wa from "../whatsapp/uazapi.js";
import { transcrever } from "../voz/elevenlabs.js";
import { atenderPneus, textoReengajamento, resumoDaConversa } from "./agente.js";

const REENGAJAR_MIN = [10, 40, 220]; // minutos depois da última mensagem do cliente
const NAO_RESPONSIVO_MIN = 400;
const TRANSFERENCIA_DEMO_MIN = 30; // na demonstração, depois disso a IA volta (para o Lucas testar de novo)
const JANELA = 40;

type Estado = {
  telefone: string;
  nome: string | null;
  desde: string;             // início da conversa atual (#reiniciar zera)
  ultimoCliente: string | null;
  etapa: number;             // retomadas já feitas (0–3)
  naoResponsivo: boolean;
  transferido: { em: string; motivo: string } | null;
};

const digitos = (s: string) => String(s || "").replace(/\D/g, "");
const fim8 = (t: string) => digitos(t).slice(-8);
const chave = (t: string) => `pneus:conv:${fim8(t)}`;

// ---------- quem está na demonstração ----------

let liberadosCache: { lista: string[]; em: number } | null = null;

async function liberados(): Promise<string[]> {
  if (liberadosCache && Date.now() - liberadosCache.em < 30e3) return liberadosCache.lista;
  const doBanco = await um<{ valor: any }>(`select valor from paloma.config where chave='pneus:demo'`).catch(() => null);
  const lista = [...(process.env.DEMO_PNEUS_TELEFONES || "").split(/[,;\s]+/), ...(doBanco?.valor?.telefones ?? [])]
    .map(digitos).filter((t) => t.length >= 10);
  liberadosCache = { lista, em: Date.now() };
  return lista;
}

export async function ehDemo(telefone: string): Promise<boolean> {
  return (await liberados()).some((t) => fim8(t) === fim8(telefone));
}

async function vendedores(): Promise<string[]> {
  const c = await um<{ valor: any }>(`select valor from paloma.config where chave='pneus:demo'`).catch(() => null);
  const lista = [...(process.env.DEMO_PNEUS_VENDEDOR || "").split(/[,;\s]+/), ...(c?.valor?.vendedores ?? [])].map(digitos).filter(Boolean);
  return lista.length ? lista : [digitos(config.adminTelefone)].filter(Boolean);
}

/**
 * Comandos de quem administra (mandados no WhatsApp da Paloma):
 *   #pneus                → liga/desliga a demonstração para o próprio número
 *   #pneus 5562999999999  → libera outro número       #pneus tirar 5562... → tira
 *   #pneus vendedor 5562… → quem recebe as transferências   #pneus status
 */
export async function comando(telefoneAdmin: string, texto: string): Promise<string> {
  const partes = texto.trim().split(/\s+/).slice(1);
  const atual = (await um<{ valor: any }>(`select valor from paloma.config where chave='pneus:demo'`))?.valor ?? {};
  const telefones: string[] = (atual.telefones ?? []).map(digitos);
  let vend: string[] = (atual.vendedores ?? []).map(digitos);
  const num = digitos(partes.find((p) => digitos(p).length >= 10) || "");
  const tem = (lista: string[], t: string) => lista.some((x) => fim8(x) === fim8(t));
  let msg: string;

  if (partes[0] === "status") {
    msg = `Demonstração TAIPNEUS\nNúmeros: ${(await liberados()).join(", ") || "nenhum"}\nVendedor: ${(await vendedores()).join(", ")}`;
  } else if (partes[0] === "vendedor" && num) {
    vend = [num];
    msg = `Transferências da demonstração vão para ${num}.`;
  } else if (partes[0] === "tirar" && num) {
    msg = `${num} saiu da demonstração.`;
    telefones.splice(0, telefones.length, ...telefones.filter((t) => fim8(t) !== fim8(num)));
  } else if (num) {
    if (!tem(telefones, num)) telefones.push(num);
    msg = `${num} agora fala com a atendente da TAIPNEUS.`;
  } else if (tem(telefones, telefoneAdmin)) {
    telefones.splice(0, telefones.length, ...telefones.filter((t) => fim8(t) !== fim8(telefoneAdmin)));
    msg = "Demonstração desligada para você: voltei a ser a Paloma 😉";
  } else {
    telefones.push(digitos(telefoneAdmin));
    msg = "Pronto: agora você fala com a atendente da TAIPNEUS. Mande uma medida pra testar. Para voltar à Paloma, mande #pneus de novo.";
  }
  await q(`insert into paloma.config (chave, valor) values ('pneus:demo', $1) on conflict (chave) do update set valor=excluded.valor, atualizado_em=now()`,
    [JSON.stringify({ ...atual, telefones, vendedores: vend })]);
  liberadosCache = null;
  return msg;
}

// ---------- estado e histórico ----------

async function lerEstado(telefone: string, nome: string | null): Promise<Estado> {
  const c = await um<{ valor: Estado }>(`select valor from paloma.config where chave=$1`, [chave(telefone)]);
  return c?.valor ?? { telefone, nome, desde: new Date().toISOString(), ultimoCliente: null, etapa: 0, naoResponsivo: false, transferido: null };
}

async function salvar(e: Estado) {
  await q(`insert into paloma.config (chave, valor) values ($1,$2) on conflict (chave) do update set valor=excluded.valor, atualizado_em=now()`,
    [chave(e.telefone), JSON.stringify(e)]);
}

async function registrar(telefone: string, papel: "user" | "assistant" | "aviso", texto: string, waId: string | null) {
  await q(`insert into paloma.mensagens (telefone, usuario_id, papel, texto, wa_id) values ($1,null,$2,$3,$4) on conflict (wa_id) do nothing`,
    [telefone, papel, texto, waId]);
}

async function historico(e: Estado, antes: Date): Promise<Anthropic.MessageParam[]> {
  const rows = (await q<{ papel: string; texto: string }>(
    `select papel, texto from paloma.mensagens where usuario_id is null and right(telefone, 8) = $1 and criado_em >= $2 and criado_em < $3
      order by criado_em desc limit $4`, [fim8(e.telefone), e.desde, antes, JANELA])).reverse();
  const msgs: Anthropic.MessageParam[] = [];
  for (const r of rows) {
    const role = r.papel === "user" ? "user" : "assistant";
    const ult = msgs[msgs.length - 1];
    if (ult && ult.role === role) ult.content = `${ult.content}\n${r.texto}`;
    else msgs.push({ role, content: r.texto });
  }
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

async function avisarVendedor(texto: string) {
  for (const v of await vendedores()) await wa.enviarTexto(v, texto).catch((e) => console.error("aviso vendedor", e));
}

// ---------- atendimento ----------

async function preparar(m: wa.Recebida): Promise<{ texto: string; blocos: Anthropic.ContentBlockParam[] }> {
  let texto = m.texto || "";
  const blocos: Anthropic.ContentBlockParam[] = [];
  if (m.tipo !== "texto" && m.id) {
    const midia = await wa.baixarMidia(m.id).catch(() => null);
    if (!midia) texto = `${texto}\n[o cliente mandou ${m.tipo}, não deu para abrir]`.trim();
    else if (m.tipo === "audio") {
      const t = await transcrever(midia.base64, midia.mime).catch(() => "");
      texto = t ? `[áudio] ${t}` : "[o cliente mandou um áudio que não deu para ouvir]";
    } else if (/^image\/(jpeg|png|gif|webp)$/.test(midia.mime)) {
      blocos.push({ type: "image", source: { type: "base64", media_type: midia.mime as any, data: midia.base64 } });
      texto = `${texto}\n[o cliente mandou uma foto]`.trim();
    } else texto = `${texto}\n[o cliente mandou um arquivo ${m.tipo}]`.trim();
  }
  return { texto, blocos };
}

export async function atender(telefone: string, lote: wa.Recebida[]) {
  const inicio = new Date();
  const nome = lote.find((m) => m.nome)?.nome ?? null;
  let e = await lerEstado(telefone, nome);

  // #reiniciar: começa uma conversa nova do zero (para testar de novo)
  if (lote.some((m) => /^\s*#reiniciar\b/i.test(m.texto))) {
    e = { telefone, nome, desde: new Date().toISOString(), ultimoCliente: null, etapa: 0, naoResponsivo: false, transferido: null };
    await salvar(e);
    await wa.enviarTexto(telefone, "🔄 Conversa reiniciada. Pode mandar como se fosse um cliente novo.");
    return;
  }

  wa.marcarLidas(lote.map((m) => m.id).filter(Boolean));
  const textos: string[] = [];
  const blocos: Anthropic.ContentBlockParam[] = [];
  for (const m of lote) {
    const p = await preparar(m);
    if (!p.texto && !p.blocos.length) continue;
    await registrar(telefone, "user", p.texto || "(sem texto)", m.id);
    textos.push(p.texto);
    blocos.push(...p.blocos);
  }
  if (!textos.length) return;

  e.nome = nome ?? e.nome;
  e.ultimoCliente = new Date().toISOString();
  // respondeu: o relógio volta a contar da próxima etapa (e.etapa fica), sem repetir retomada já feita
  if (e.naoResponsivo) { e.naoResponsivo = false; e.etapa = 0; } // voltou depois do Não Responsivo: a IA atende de novo

  if (e.transferido) {
    const minutos = (Date.now() - new Date(e.transferido.em).getTime()) / 60e3;
    if (minutos < TRANSFERENCIA_DEMO_MIN) {
      // conversa é do vendedor: a IA só repassa o que chegou
      await salvar(e);
      await avisarVendedor(`💬 ${e.nome || telefone} (em atendimento com você):\n${textos.join("\n")}`);
      return;
    }
    e.transferido = null;
  }
  await salvar(e);

  const juntas = textos.length > 1 ? textos.map((t) => `• ${t}`).join("\n") : textos[0];
  blocos.push({ type: "text", text: juntas });

  await wa.digitando(telefone);
  const presenca = setInterval(() => wa.digitando(telefone), 8000);
  let transferiu: { motivo: string; resumo: string } | null = null;
  try {
    const anteriores = await historico(e, inicio);
    const resposta = await atenderPneus({
      telefone,
      nome: e.nome,
      registrarEnvio: (t, id) => registrar(telefone, "assistant", t, id),
      aoTransferir: async (motivo, resumo) => { transferiu = { motivo, resumo }; },
    }, anteriores, blocos);
    clearInterval(presenca);
    if (resposta) {
      await wa.digitando(telefone);
      await new Promise((ok) => setTimeout(ok, Math.min(800 + resposta.length * 15, 2500)));
      const id = await wa.enviarTexto(telefone, resposta);
      await registrar(telefone, "assistant", resposta, id);
    }
  } catch (err) {
    console.error("pneus", err);
    transferiu = { motivo: "falha na IA", resumo: `Mensagem do cliente: ${juntas}` };
  } finally {
    clearInterval(presenca);
  }

  if (transferiu) {
    const t = transferiu as { motivo: string; resumo: string };
    e.transferido = { em: new Date().toISOString(), motivo: t.motivo };
    await salvar(e);
    await avisarVendedor(
      `🛞 *Lead para você — TAIPNEUS*\nCliente: ${e.nome || "sem nome"} (${telefone})\nMotivo: ${t.motivo}\n\n${t.resumo}\n\n` +
      `_A IA parou de responder esse cliente; a conversa é sua._`);
  }
}

// ---------- reengajamento ----------

export async function reengajar() {
  const conversas = await q<{ chave: string; valor: Estado }>(`select chave, valor from paloma.config where chave like 'pneus:conv:%'`);
  for (const { valor: e } of conversas) {
    if (!e.ultimoCliente || e.transferido || e.naoResponsivo) continue;
    if (!(await ehDemo(e.telefone))) continue;
    const parado = (Date.now() - new Date(e.ultimoCliente).getTime()) / 60e3;
    // só retoma se a última palavra foi da loja (o cliente é quem sumiu)
    const ultima = await um<{ papel: string }>(
      `select papel from paloma.mensagens where usuario_id is null and right(telefone,8)=$1 and criado_em >= $2 order by criado_em desc limit 1`,
      [fim8(e.telefone), e.desde]);
    if (ultima?.papel === "user") continue;
    try {
      if (parado >= NAO_RESPONSIVO_MIN && e.etapa >= 3) {
        const hist = await historico(e, new Date());
        const resumo = hist.length > 1 ? await resumoDaConversa(hist) : "";
        e.naoResponsivo = true;
        await salvar(e);
        await registrar(e.telefone, "aviso", `[Não Responsivo] ${resumo}`, null);
        await avisarVendedor(`📋 *Não Responsivo* — ${e.nome || e.telefone}\n${resumo || "sem conversa"}\n_Conversa encerrada; a IA volta a atender se o cliente chamar._`);
        continue;
      }
      if (e.etapa < 3 && parado >= REENGAJAR_MIN[e.etapa]) {
        const hist = await historico(e, new Date());
        const texto = await textoReengajamento(hist, e.etapa + 1);
        if (!texto) continue;
        e.etapa += 1;
        await salvar(e); // marca antes de enviar: reinício do servidor não manda em dobro
        const id = await wa.enviarTexto(e.telefone, texto);
        await registrar(e.telefone, "assistant", texto, id);
      }
    } catch (err) {
      console.error("reengajar", e.telefone, err);
    }
  }
}
