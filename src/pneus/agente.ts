/**
 * Atendente de vendas da TAIPNEUS (Goiânia) — demonstração para o Lucas.
 * Mesmo cérebro da Paloma (Claude + ferramentas em loop), com outra persona e outras ferramentas:
 * consulta o estoque do Ômie, manda a foto real do pneu com descrição e valor e, quando a conversa
 * sai do roteiro, passa em silêncio para o vendedor.
 *
 * Tom de voz: o guia que o Lucas mandou em 03/11/2026 (curto, direto, sem emoji, sem diminutivo).
 */
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { q } from "../db.js";
import * as wa from "../whatsapp/uazapi.js";
import { estoque, buscar, buscarTexto, lerMedida, legenda, brl, type Pneu } from "./catalogo.js";

const client = new Anthropic({ apiKey: config.anthropicKey });
const MAX_PASSOS = 8;
const FOTOS_POR_VEZ = 3;

export const PERSONA_PNEUS = `Você atende o WhatsApp da TAIPNEUS Distribuidora, revenda de pneus em Goiânia (GO), atacado e varejo.
Só pneu de carro, caminhonete, van e caminhão: nada de pneu de moto, peças, rodas ou serviços.

QUEM VOCÊ É
Um vendedor da loja. Nunca diga ou insinue que é IA, robô, assistente virtual ou atendimento automático.
Se perguntarem, responda como gente da loja e siga a venda.

TOM DE VOZ E ESTILO DE LINGUAGEM (guia do dono da loja, siga à risca)
- Escreva em primeira pessoa, curto e direto. Uma ideia por mensagem. Responda primeiro o que o cliente perguntou e pare. Faça uma pergunta por vez.
- Fale como vendedor de loja de pneus: natural, sem formalidade e sem exagero. Gírias simples são bem-vindas:
  "opa", "beleza", "show", "tranquilo", "certinho", "tá na mão", "pode deixar", "meu amigo", "valeu". No máximo uma por mensagem. Uma conversa sem nenhuma também está certa.
- Nunca use emoji, figurinha, "kkk" ou "rs".
- Não use diminutivos ("minutinho", "probleminha") nem "taí".
- Não use abreviação de internet (vc, tbm, pq). Português correto, com acento e maiúscula no início das frases.
- Cumprimente uma única vez, na primeira resposta da conversa. Depois disso, não repita saudação nem o nome do cliente. Não use o nome do cliente.
- Não peça desculpa em excesso, não se justifique e não fale de sistema, gerente ou problema interno.
- Nunca escreva "não rola", "não dá" ou "não tem como".
- Nada de listas, negrito, títulos ou markdown.
Exemplos:
- Primeira mensagem: "Opa, boa tarde! Qual a medida do pneu?"
- Cliente pergunta "tudo bem?": "Tudo certo. Qual a medida do pneu?"
- Preço e pagamento: "Esse valor é no Pix. No cartão, até 4x sem juros."
- Cliente agradece: "Valeu! Qualquer coisa é só chamar."

COMO A LOJA VENDE
1. Sem a medida, pergunte a medida. O cliente costuma mandar seco ("205 40 17, dois pneus, valor?").
2. Com a medida, use buscar_pneus e depois mostrar_pneus: a foto real já vai com descrição e valor na legenda.
   Mostre até 3 opções, das mais em conta para as mais caras, a não ser que ele peça marca específica.
   Depois das fotos, NÃO escreva nada: a foto com o valor é a resposta. Nada de "mandei as fotos" ou "essas são as opções".
   Se não tiver a medida exata, escreva só "Nessa medida não tenho. A mais próxima é essa:" e mostre.
   Se ele pediu mais unidades do que há, diga quantas tem, em uma frase.
   Se ele respondeu citando uma foto, ele está falando daquele pneu.
3. Perguntou forma de pagamento ou parcelamento (até 4x): "Esse valor é no Pix. No cartão, até 4x sem juros."
4. Pediu desconto, "quanto fica à vista", "faz por menos": na primeira vez, responda que o valor já é o do Pix e no cartão até 4x sem juros.
   Se insistir, use transferir_vendedor.
5. Quer fechar ("vou querer", "pode separar", "vou buscar"): antes de passar, confirme o que faltar, uma pergunta por mensagem, no máximo duas no total:
   a quantidade (se ele não disse) e "Vai retirar na loja ou quer entrega?". Com isso, responda "Pode deixar, já vou separar aqui." e use transferir_vendedor.
   Se for entrega, use a regra 6.
6. Entrega ou frete: "Tem uma taxa pequena. Me manda sua localização que eu vejo pra você." e use transferir_vendedor. Não calcule frete.
7. Use transferir_vendedor também quando: pedir mais de 4x; for revenda, borracharia ou atacado; for pneu de moto ou outro assunto que não é pneu;
   reclamar ou cobrar demora; pedir para falar com uma pessoa ou pedir ligação; não souber a medida; mandar foto que você não entendeu; montagem, alinhamento,
   garantia, nota fiscal, troca ou devolução. Quando a transferência não pede outra frase, responda só "Certinho, um momento."

TRANSFERÊNCIA
É silenciosa: nunca diga que vai passar para vendedor, humano, gerente ou atendente. Depois de transferir, a conversa é do vendedor.

REGRAS
- Nunca invente pneu, preço, estoque ou prazo: tudo vem das ferramentas.
- Nunca prometa desconto. Nunca dê o assunto por encerrado nem marque venda perdida.
- O cliente pode mandar áudio (vem transcrito) ou foto de pneu: leia a medida da lateral se der.`;

const FERRAMENTAS: Anthropic.Tool[] = [
  {
    name: "buscar_pneus",
    description: "Procura no estoque da loja (Ômie, ao vivo) pela medida. Devolve os pneus com saldo, preço e se têm foto. " +
      "Sem a medida exata, devolve as medidas mais próximas do mesmo aro.",
    input_schema: {
      type: "object",
      properties: {
        medida: { type: "string", description: "Medida como o cliente mandou, ex.: \"205/40 R17\", \"205 40 17\", \"265/65R17\". Vazio para buscar por texto." },
        texto: { type: "string", description: "Opcional: marca ou modelo (\"XBRI\", \"GOODYEAR\", \"A/T\"), ou busca livre quando não há medida." },
      },
    },
  },
  {
    name: "mostrar_pneus",
    description: "Manda no WhatsApp do cliente a FOTO real de cada pneu, com a descrição e o valor na legenda. Use os códigos devolvidos por buscar_pneus. Máximo 3 por vez.",
    input_schema: {
      type: "object",
      properties: { codigos: { type: "array", items: { type: "string" }, description: "Campo `codigo` dos pneus escolhidos." } },
      required: ["codigos"],
    },
  },
  {
    name: "transferir_vendedor",
    description: "Passa a conversa para o vendedor, em silêncio, com um resumo para ele só fechar. Depois disso você para de responder este cliente.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Por que transferiu: quer fechar, desconto insistente, entrega, revenda, fora do roteiro..." },
        resumo: { type: "string", description: "Pneu(s) com medida e marca, quantidade, valores mostrados, pagamento falado, retirada ou entrega, o que o cliente quer e o que falta." },
      },
      required: ["motivo", "resumo"],
    },
  },
];

/**
 * Rede de segurança do tom: o que o modelo escrever passa por aqui antes de ir para o cliente.
 * Tira emoji e risada, troca os diminutivos e o "taí" proibidos e junta espaços.
 */
export function noTom(texto: string): string {
  return String(texto || "")
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u{FE0F}|\u{200D}/gu, "")
    .replace(/\s*(?<!\p{L})(k{3,}|rs+)(?!\p{L})/giu, "")
    .replace(/(?<!\p{L})minutinho(?!\p{L})/giu, (m) => (m[0] === "M" ? "Momento" : "momento"))
    .replace(/(?<!\p{L})probleminha(?!\p{L})/giu, "problema")
    .replace(/(?<!\p{L})Taí(?!\p{L})/gu, "Aqui está").replace(/(?<!\p{L})taí(?!\p{L})/gu, "aqui está")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?])/g, "$1")
    .trim();
}

export type Contexto = {
  telefone: string;
  nome: string | null;
  /** chamado quando a IA decide transferir; quem chama cuida de avisar o vendedor e desligar a IA */
  aoTransferir: (motivo: string, resumo: string) => Promise<void>;
  /** grava no histórico cada mensagem que a IA mandou (texto ou foto) */
  registrarEnvio: (texto: string, waId: string | null) => Promise<void>;
};

const mostrados = new Map<string, Pneu>(); // código → pneu, da última busca

function codigo(p: Pneu) {
  return p.sku || p.alias.slice(0, 10);
}

function descrever(p: Pneu) {
  mostrados.set(codigo(p), p);
  return { codigo: codigo(p), descricao: p.titulo, preco: brl(p.preco), estoque: p.estoque, tem_foto: p.fotos.length > 0 };
}

async function executar(ctx: Contexto, nome: string, input: any): Promise<{ conteudo: string; transferiu?: boolean }> {
  if (nome === "buscar_pneus") {
    const itens = await estoque();
    const medida = lerMedida(String(input.medida || ""));
    if (!medida) {
      const achados = buscarTexto(itens, String(input.texto || input.medida || ""));
      return { conteudo: JSON.stringify({ medida_entendida: null, resultados: achados.map(descrever) }) };
    }
    const { exatos, parecidos } = buscar(itens, medida, String(input.texto || ""));
    return {
      conteudo: JSON.stringify({
        medida_entendida: medida.texto,
        tem_a_medida: exatos.length > 0,
        resultados: exatos.slice(0, 8).map(descrever),
        mais_proximas: parecidos.map(descrever),
      }),
    };
  }

  if (nome === "mostrar_pneus") {
    const enviados: string[] = [];
    for (const c of (input.codigos ?? []).slice(0, FOTOS_POR_VEZ)) {
      const p = mostrados.get(String(c));
      if (!p) continue;
      const texto = legenda(p);
      let waId: string | null = null;
      if (p.fotos[0]) {
        waId = await wa.enviarMidiaUrl(ctx.telefone, p.fotos[0], texto).catch(async (e) => {
          console.error("foto do pneu", e);
          return wa.enviarTexto(ctx.telefone, texto);
        });
      } else {
        waId = await wa.enviarTexto(ctx.telefone, texto);
      }
      await ctx.registrarEnvio(`[foto do pneu] ${texto}`, waId);
      enviados.push(p.titulo);
      await new Promise((ok) => setTimeout(ok, 900));
    }
    return {
      conteudo: enviados.length
        ? `Enviado para o cliente: ${enviados.join("; ")}. Não escreva mais nada agora.`
        : "Nenhum código válido; faça buscar_pneus antes.",
    };
  }

  if (nome === "transferir_vendedor") {
    await ctx.aoTransferir(String(input.motivo || ""), String(input.resumo || ""));
    return { conteudo: "Transferido. Se ainda não respondeu o cliente neste turno, mande só a frase curta combinada e encerre.", transferiu: true };
  }

  return { conteudo: `Ferramenta desconhecida: ${nome}` };
}

function agoraTexto() {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short" }).format(new Date());
}

/**
 * Um turno de atendimento. Texto que a IA escreve antes de usar uma ferramenta sai na hora,
 * na ordem: "Opa, boa tarde!" → fotos → (nada). Devolve o texto final, já no tom (pode ser vazio).
 */
export async function atenderPneus(ctx: Contexto, historico: Anthropic.MessageParam[], conteudo: Anthropic.ContentBlockParam[], extraSistema = ""): Promise<string> {
  const jaCumprimentou = historico.some((m) => m.role === "assistant");
  const sistema: Anthropic.TextBlockParam[] = [
    { type: "text", text: PERSONA_PNEUS, cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text: [
        `Agora: ${agoraTexto()} (horário de Goiânia).`,
        jaCumprimentou ? "Você já cumprimentou este cliente: não cumprimente de novo." : "Esta é a sua primeira resposta: cumprimente uma vez (bom dia, boa tarde ou boa noite conforme a hora).",
        extraSistema,
      ].filter(Boolean).join("\n"),
    },
  ];
  const ult = historico[historico.length - 1];
  const mensagens: Anthropic.MessageParam[] = ult?.role === "user"
    ? [...historico.slice(0, -1), { role: "user", content: [{ type: "text", text: String(ult.content) }, ...conteudo] }]
    : [...historico, { role: "user", content: conteudo }];

  let fotosNoTurno = false;
  for (let passo = 0; passo < MAX_PASSOS; passo++) {
    const r = await client.beta.messages.create({
      model: config.modelo,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: sistema,
      tools: FERRAMENTAS,
      messages: mensagens as any,
    } as any) as any;
    await q(`insert into paloma.uso_ia (usuario_id, modelo, entrada, saida, cache_lido) values (null,$1,$2,$3,$4)`,
      [`pneus:${r.model}`, r.usage?.input_tokens ?? 0, r.usage?.output_tokens ?? 0, r.usage?.cache_read_input_tokens ?? 0]).catch(() => {});

    mensagens.push({ role: "assistant", content: r.content });
    const textos = noTom((r.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("\n"));
    const usos = (r.content as any[]).filter((b) => b.type === "tool_use");
    if (r.stop_reason !== "tool_use" || !usos.length) {
      if (r.stop_reason === "pause_turn") continue;
      // depois das fotos a foto com o valor é a resposta: comentário de "mandei as fotos" não sai
      if (fotosNoTurno && /\b(mandei|enviei|te mostrei|essas s[ãa]o|esses s[ãa]o|as op[çc][õo]es)\b/i.test(textos) && !/\?/.test(textos)) return "";
      return textos;
    }
    if (textos) { // fala antes de agir (cumprimento antes da foto)
      const id = await wa.enviarTexto(ctx.telefone, textos);
      await ctx.registrarEnvio(textos, id);
      await wa.digitando(ctx.telefone);
    }
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const b of usos) { // em ordem: as fotos saem na sequência que a IA escolheu
      const res = await executar(ctx, b.name, b.input).catch((e) => ({ conteudo: `Erro: ${String(e?.message || e)}` }));
      if (b.name === "mostrar_pneus") fotosNoTurno = true;
      resultados.push({ type: "tool_result", tool_use_id: b.id, content: res.conteudo });
    }
    mensagens.push({ role: "user", content: resultados });
  }
  return "";
}

const GUIA_RETOMADA: Record<string, string> = {
  primeira: "Primeira retomada, minutos depois: só uma pergunta curta e leve sobre o que ele viu (ex.: \"Conseguiu ver os pneus?\").",
  meio: "Retomada do mesmo dia: lembre em uma frase o pneu ou a medida que ele pediu e que ainda tem no estoque, sem pressão.",
  ultima_do_dia: "Última retomada do dia: curta, deixe a porta aberta (\"Se precisar, é só chamar.\").",
  dia_seguinte: "Retomada no dia seguinte: cumprimente conforme a hora e pergunte se ele ainda precisa do pneu daquela medida.",
  reativacao: "Faz uma semana que ele parou de responder: cumprimente conforme a hora e pergunte de forma simples se ainda precisa de pneu.",
};

/** Mensagem de retomada curta, no tom da loja, a partir da conversa. */
export async function textoReengajamento(historico: Anthropic.MessageParam[], tipo: keyof typeof GUIA_RETOMADA): Promise<string> {
  const r = await client.messages.create({
    model: config.modeloRapido,
    max_tokens: 200,
    system: `${PERSONA_PNEUS}\n\nAgora: ${agoraTexto()}. O cliente parou de responder. Escreva SÓ a mensagem de retomada, uma frase, sem aspas, sem o nome dele. ${GUIA_RETOMADA[tipo]}`,
    messages: [...historico.filter((m) => typeof m.content === "string"), { role: "user", content: "[sistema: o cliente não respondeu; escreva a retomada]" }] as any,
  });
  return noTom(r.content.filter((b) => b.type === "text").map((b: any) => b.text).join(" "));
}

/** Resumo para o card quando a conversa vai para Não Responsivo. */
export async function resumoDaConversa(historico: Anthropic.MessageParam[]): Promise<string> {
  const conversa = historico.map((m) => `${m.role === "user" ? "Cliente" : "Loja"}: ${String(m.content)}`).join("\n").slice(-6000);
  const r = await client.messages.create({
    model: config.modeloRapido,
    max_tokens: 300,
    messages: [{ role: "user", content: `Resuma em 2 linhas para o card do CRM: qual pneu/medida, quantidade, pagamento falado e o que faltou.\n\n${conversa}` }],
  });
  return r.content.filter((b) => b.type === "text").map((b: any) => b.text).join(" ").trim();
}
