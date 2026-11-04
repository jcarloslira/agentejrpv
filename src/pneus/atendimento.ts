/**
 * Roteamento da demonstração da TAIPNEUS dentro do número da Paloma.
 *
 * Só os números liberados (DEMO_PNEUS_TELEFONES ou "#pneus" mandado por um admin) falam com a
 * atendente de pneus; o resto do número continua exatamente como antes (Paloma para a equipe,
 * silêncio para quem não é cadastrado).
 *
 * Regras do Lucas (29/10 e 03/11/2026):
 *  - transferência silenciosa: o vendedor recebe o resumo e a IA para de responder aquele cliente;
 *    enquanto o cliente espera, o vendedor é lembrado (5, 15 e 30 min);
 *  - se o vendedor responder pelo celular, a IA se desliga naquela conversa;
 *  - follow-up escalonado pelo momento da conversa (a partir da última mensagem do cliente):
 *    cliente quente (já viu pneu e respondeu) 10 / 30 / 60 / 90 min; frio 10 / 40 min / 3h40 / 6h40;
 *    mais um no dia seguinte; 4h depois dele vai para Não Responsivo (encerra e grava o resumo,
 *    nunca marca venda perdida); 7 dias depois, uma reativação;
 *  - cliente que volta depois do Não Responsivo é atendido de novo pela IA.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { q, um } from "../db.js";
import { config } from "../config.js";
import * as wa from "../whatsapp/uazapi.js";
import { transcrever } from "../voz/elevenlabs.js";
import { atenderPneus, textoReengajamento, resumoDaConversa, noTom } from "./agente.js";

const RETOMADA_QUENTE_MIN = [10, 30, 60, 90, 1440];
const RETOMADA_FRIA_MIN = [10, 40, 220, 400, 1440];
const NAO_RESPONSIVO_DEPOIS_MIN = 240;  // depois da última retomada
const REATIVAR_MIN = 7 * 24 * 60;       // depois do Não Responsivo
const LEMBRAR_VENDEDOR_MIN = [5, 15, 30];
const TRANSFERENCIA_DEMO_MIN = 30;      // demonstração: sem o vendedor ter respondido, a IA volta depois disso
const JANELA = 40;

type Estado = {
  telefone: string;
  nome: string | null;
  desde: string;             // início da conversa atual (#reiniciar zera)
  ultimoCliente: string | null;
  etapa: number;             // retomadas já feitas
  quente?: boolean;          // já viu pneu e respondeu depois
  naoResponsivo: boolean;
  naoResponsivoEm?: string | null;
  reativado?: boolean;
  transferido: { em: string; motivo: string } | null;
  vendedorEm?: string | null;      // vendedor respondeu pelo celular: a conversa é dele
  esperandoDesde?: string | null;  // cliente escreveu depois da transferência e ninguém respondeu
  lembretes?: number;
};

const digitos = (s: string) => String(s || "").replace(/\D/g, "");
const fim8 = (t: string) => digitos(t).slice(-8);
const chave = (t: string) => `pneus:conv:${fim8(t)}`;
const minutosDesde = (iso: string | null | undefined) => (iso ? (Date.now() - new Date(iso).getTime()) / 60e3 : Infinity);

function saudacao() {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()));
  return h < 12 ? "bom dia" : h < 18 ? "boa tarde" : "boa noite";
}

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
 *   #pneus chamar 5562… [texto] → a loja manda a 1ª mensagem (puxa assunto) e libera o número
 */
export async function comando(telefoneAdmin: string, texto_: string): Promise<string> {
  const partes = texto_.trim().split(/\s+/).slice(1);
  const atual = (await um<{ valor: any }>(`select valor from paloma.config where chave='pneus:demo'`))?.valor ?? {};
  const telefones: string[] = (atual.telefones ?? []).map(digitos);
  let vend: string[] = (atual.vendedores ?? []).map(digitos);
  const num = digitos(partes.find((p) => digitos(p).length >= 10) || "");
  const tem = (lista: string[], t: string) => lista.some((x) => fim8(x) === fim8(t));
  const gravar = async () => {
    await q(`insert into paloma.config (chave, valor) values ('pneus:demo', $1) on conflict (chave) do update set valor=excluded.valor, atualizado_em=now()`,
      [JSON.stringify({ ...atual, telefones, vendedores: vend })]);
    liberadosCache = null;
  };
  let msg: string;

  if (partes[0] === "chamar" && num) {
    // a loja puxa assunto: a mensagem entra no histórico, e a resposta do cliente já cai aqui com contexto
    const s = saudacao();
    const texto = texto_.replace(/^\s*#pneus\s+chamar\s+\S+\s*/i, "").trim() || `Opa, ${s}! Qual a medida do pneu?`;
    if (!tem(telefones, num)) telefones.push(num);
    await gravar();
    await salvar(novoEstado(num, null));
    const id = await wa.enviarTexto(num, texto);
    await registrar(num, "assistant", texto, id);
    return `Mandei para ${num}:\n"${texto}"`;
  }

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
    msg = "Demonstração desligada para você: voltei a ser a Paloma.";
  } else {
    telefones.push(digitos(telefoneAdmin));
    msg = "Pronto: agora você fala com a atendente da TAIPNEUS. Mande uma medida pra testar. Para voltar à Paloma, mande #pneus de novo.";
  }
  await gravar();
  return msg;
}

// ---------- estado e histórico ----------

function novoEstado(telefone: string, nome: string | null): Estado {
  return { telefone, nome, desde: new Date().toISOString(), ultimoCliente: null, etapa: 0, quente: false, naoResponsivo: false, transferido: null };
}

async function lerEstado(telefone: string, nome: string | null): Promise<Estado> {
  const c = await um<{ valor: Estado }>(`select valor from paloma.config where chave=$1`, [chave(telefone)]);
  return c?.valor ?? novoEstado(telefone, nome);
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
      and papel <> 'aviso' order by criado_em desc limit $4`, [fim8(e.telefone), e.desde, antes, JANELA])).reverse();
  const msgs: Anthropic.MessageParam[] = [];
  for (const r of rows) {
    const role = r.papel === "user" ? "user" : "assistant";
    const ult = msgs[msgs.length - 1];
    if (ult && ult.role === role) ult.content = `${ult.content}\n${r.texto}`;
    else msgs.push({ role, content: r.texto });
  }
  // a API pede que comece pelo cliente; quando foi a loja que puxou assunto, isso fica dito
  if (msgs.length && msgs[0].role !== "user") msgs.unshift({ role: "user", content: "[a loja puxou assunto com este cliente]" });
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
  // respondeu citando uma mensagem (ex.: a foto de um pneu): diz qual era
  if (m.citadaId || m.citada) {
    const orig = m.citadaId ? await um<{ texto: string }>(`select texto from paloma.mensagens where wa_id=$1`, [m.citadaId]).catch(() => null) : null;
    const citada = (orig?.texto || m.citada || "").replace(/\s+/g, " ").slice(0, 200);
    if (citada) texto = `[respondendo à mensagem: "${citada}"]\n${texto}`;
  }
  return { texto, blocos };
}

export async function atender(telefone: string, lote: wa.Recebida[]) {
  const inicio = new Date();
  const nome = lote.find((m) => m.nome)?.nome ?? null;
  let e = await lerEstado(telefone, nome);

  // #reiniciar: começa uma conversa nova do zero (para testar de novo)
  if (lote.some((m) => /^\s*#reiniciar\b/i.test(m.texto))) {
    e = novoEstado(telefone, nome);
    await salvar(e);
    await wa.enviarTexto(telefone, "Conversa reiniciada. Pode mandar como se fosse um cliente novo.");
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
  if (e.naoResponsivo) { e.naoResponsivo = false; e.naoResponsivoEm = null; e.reativado = false; e.etapa = 0; }
  const anteriores = await historico(e, inicio);
  if (anteriores.some((m) => String(m.content).includes("[foto do pneu]"))) e.quente = true;

  if (e.transferido) {
    const doVendedor = !!e.vendedorEm || minutosDesde(e.transferido.em) < TRANSFERENCIA_DEMO_MIN;
    if (doVendedor) {
      // conversa é do vendedor: a IA só repassa o que chegou e marca que o cliente está esperando
      if (!e.esperandoDesde) { e.esperandoDesde = new Date().toISOString(); e.lembretes = 0; }
      await salvar(e);
      const reclamou = /demor|cad[eê]|ningu[eé]m|n[aã]o quero mais|desist/i.test(textos.join(" "));
      await avisarVendedor(`${reclamou ? "⚠️ *Cliente reclamando, responda já*" : "💬 *Cliente escreveu*"} — ${e.nome || telefone}\n${textos.join("\n")}`);
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
    e.vendedorEm = null;
    e.esperandoDesde = new Date().toISOString(); // acabou de passar: o cliente está esperando o vendedor
    e.lembretes = 0;
    await salvar(e);
    await avisarVendedor(
      `🛞 *Lead para você — TAIPNEUS*\nCliente: ${e.nome || "sem nome"} (${telefone})\nMotivo: ${t.motivo}\n\n${t.resumo}\n\n` +
      `_A IA parou de responder esse cliente; a conversa é sua. Responda pelo celular do número._`);
  }
}

/** O vendedor digitou no celular do número para um cliente da demonstração: a conversa passa a ser dele. */
export async function vendedorRespondeu(p: { id: string; telefone: string; texto: string }) {
  if (!(await ehDemo(p.telefone))) return;
  const e = await lerEstado(p.telefone, null);
  await registrar(p.telefone, "assistant", `[vendedor] ${p.texto}`, p.id || null);
  e.transferido ??= { em: new Date().toISOString(), motivo: "vendedor assumiu a conversa" };
  e.vendedorEm = new Date().toISOString();
  e.esperandoDesde = null;
  e.lembretes = 0;
  await salvar(e);
}

/**
 * Pedido de "chamar" gravado direto no banco (chave pneus:chamar:<qualquer>, valor {telefone, texto?}),
 * para disparar sem precisar do WhatsApp do admin. Apaga antes de enviar: não manda em dobro.
 */
export async function chamadasPendentes() {
  const fila = await q<{ chave: string; valor: any }>(`delete from paloma.config where chave like 'pneus:chamar:%' returning chave, valor`);
  for (const f of fila) {
    const tel = digitos(f.valor?.telefone);
    if (tel.length < 10) continue;
    const r = await comando(config.adminTelefone, `#pneus chamar ${tel} ${String(f.valor?.texto || "")}`)
      .catch((e) => `Não consegui chamar ${tel}: ${e?.message || e}`);
    console.log("pneus chamar", tel, r.slice(0, 80));
    await avisarVendedor(`📤 ${r}`).catch(() => {});
  }
}

// ---------- follow-up e lembretes ----------

/** Qual retomada vem agora (ou nenhuma), pelo tempo parado e pelo momento da conversa. */
export function proximaRetomada(e: Pick<Estado, "etapa" | "quente">, paradoMin: number):
  { tipo: "primeira" | "meio" | "ultima_do_dia" | "dia_seguinte" } | { naoResponsivo: true } | null {
  const tabela = e.quente ? RETOMADA_QUENTE_MIN : RETOMADA_FRIA_MIN;
  if (e.etapa >= tabela.length) return paradoMin >= tabela[tabela.length - 1] + NAO_RESPONSIVO_DEPOIS_MIN ? { naoResponsivo: true } : null;
  if (paradoMin < tabela[e.etapa]) return null;
  const tipo = e.etapa === 0 ? "primeira" : e.etapa === tabela.length - 1 ? "dia_seguinte" : e.etapa === tabela.length - 2 ? "ultima_do_dia" : "meio";
  return { tipo };
}

async function enviarRetomada(e: Estado, tipo: Parameters<typeof textoReengajamento>[1]) {
  const texto = await textoReengajamento(await historico(e, new Date()), tipo);
  if (!texto) return false;
  const id = await wa.enviarTexto(e.telefone, noTom(texto));
  await registrar(e.telefone, "assistant", texto, id);
  return true;
}

export async function reengajar() {
  const conversas = await q<{ chave: string; valor: Estado }>(`select chave, valor from paloma.config where chave like 'pneus:conv:%'`);
  for (const { valor: e } of conversas) {
    if (!(await ehDemo(e.telefone))) continue;
    try {
      // cliente esperando o vendedor: lembra o vendedor até alguém responder
      if (e.transferido && e.esperandoDesde && !e.vendedorEm) {
        const n = e.lembretes ?? 0;
        const esperando = minutosDesde(e.esperandoDesde);
        if (n < LEMBRAR_VENDEDOR_MIN.length && esperando >= LEMBRAR_VENDEDOR_MIN[n]) {
          e.lembretes = n + 1;
          await salvar(e);
          await avisarVendedor(`⏰ ${e.nome || e.telefone} está esperando resposta há ${Math.round(esperando)} min. ` +
            `Motivo: ${e.transferido.motivo}. Responda antes que ele desista.`);
        }
        continue;
      }
      if (!e.ultimoCliente || e.transferido) continue;

      // Não Responsivo há 7 dias: uma reativação
      if (e.naoResponsivo) {
        if (!e.reativado && minutosDesde(e.naoResponsivoEm) >= REATIVAR_MIN) {
          e.reativado = true;
          await salvar(e);
          await enviarRetomada(e, "reativacao");
        }
        continue;
      }

      // só retoma se a última palavra foi da loja (o cliente é quem sumiu)
      const ultima = await um<{ papel: string }>(
        `select papel from paloma.mensagens where usuario_id is null and right(telefone,8)=$1 and criado_em >= $2 and papel <> 'aviso'
          order by criado_em desc limit 1`, [fim8(e.telefone), e.desde]);
      if (ultima?.papel === "user") continue;

      const proxima = proximaRetomada(e, minutosDesde(e.ultimoCliente));
      if (!proxima) continue;
      if ("naoResponsivo" in proxima) {
        const hist = await historico(e, new Date());
        const resumo = hist.length > 1 ? await resumoDaConversa(hist) : "";
        e.naoResponsivo = true;
        e.naoResponsivoEm = new Date().toISOString();
        await salvar(e);
        await registrar(e.telefone, "aviso", `[Não Responsivo] ${resumo}`, null);
        await avisarVendedor(`📋 *Não Responsivo* — ${e.nome || e.telefone}\n${resumo || "sem conversa"}\n_Conversa encerrada; a IA volta a atender se o cliente chamar e reativa em 7 dias._`);
        continue;
      }
      e.etapa += 1;
      await salvar(e); // marca antes de enviar: reinício do servidor não manda em dobro
      await enviarRetomada(e, proxima.tipo);
    } catch (err) {
      console.error("reengajar", e.telefone, err);
    }
  }
}
