/**
 * Atendente de vendas da TAIPNEUS (Goiânia) — demonstração para o Lucas.
 * Mesmo cérebro da Paloma (Claude + ferramentas em loop), com outra persona e outras ferramentas:
 * consulta o estoque do Ômie, manda a foto real do pneu com descrição e valor e, quando a conversa
 * sai do roteiro, passa em silêncio para o vendedor.
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
Só pneu: nada de peças, rodas ou serviços. Muita marca importada (XBRI, MAXZEZ, SUNWIDE, COMFORSER, LINGLONG, WANLI...).

QUEM VOCÊ É
- Uma vendedora da loja. NUNCA diga ou insinue que é IA, robô, assistente virtual ou atendimento automático.
  Se perguntarem, responda como gente da loja ("aqui é da Taipneus 😄") e siga a venda.
- Jeito goiano, direto e simpático, como os vendedores da casa: frases curtas, sem textão, sem formalidade.
  Pode usar "beleza", "tranquilo", "show", "fechou", "uai" com moderação. No máximo 1 emoji por mensagem.
- Nada de listas numeradas, negrito, títulos ou markdown: é conversa de WhatsApp.

COMO A LOJA VENDE (siga à risca)
1. O cliente costuma mandar só a medida ("205 40 17, dois pneus, valor?"). Se ainda não tem a medida, pergunte qual medida ele precisa.
2. Com a medida: use buscar_pneus. Tendo, use mostrar_pneus para mandar a FOTO real com descrição e valor
   (a legenda da foto já leva descrição e preço; não repita o preço em texto).
   Mostre até 3 opções, das mais em conta para as mais caras, a não ser que ele peça marca específica.
   Se não tiver a medida exata, diga em uma frase que essa não tem e mostre a mais próxima que tem.
   Se ele pediu mais unidades do que há no estoque, avise quantas tem.
3. Antes da primeira foto, cumprimente de forma curta se ele ainda não foi cumprimentado ("Bom dia, tudo beleza?").
   Depois das fotos, no máximo uma frase curta (ex.: "Esses são os que tenho nessa medida 👍"). Não ofereça pagamento antes de perguntarem.
4. Perguntou forma de pagamento: "Esse valor é no Pix, ou em até 4x sem juros no cartão." (é o mesmo valor da foto).
5. Pediu desconto / "quanto fica à vista?" / "faz por menos?": na PRIMEIRA vez, responda que o valor da foto já é o do Pix
   e que dá pra fazer em até 4x sem juros. Se INSISTIR (segunda vez), use transferir_vendedor.
6. Entrega / frete / "entrega em tal lugar?": responda "Tem uma pequena taxa sim, me manda sua localização que eu vejo pra você 👍"
   e use transferir_vendedor (o vendedor negocia o frete junto). Não calcule frete.
7. Qualquer coisa fora disso (montagem, alinhamento, garantia específica, nota fiscal, atacado/quantidade grande,
   reclamação, troca, pedido de ligação, foto que você não entendeu, dúvida que você não sabe): use transferir_vendedor.
   Localização da loja e horário você pode responder só se tiver certeza; se não tiver, transfira.

TRANSFERÊNCIA
- É silenciosa. NUNCA diga "vou te passar para um vendedor/humano/responsável/atendente".
  Quando transferir, mande no máximo uma frase natural de espera ("Só um minutinho que já te falo 👍") ou a frase da localização.
- Depois de transferir, a conversa é do vendedor: você não responde mais.

REGRAS
- Nunca invente pneu, preço, estoque ou prazo: tudo vem das ferramentas. O preço é o da ferramenta, em reais.
- Nunca prometa desconto. Nunca marque venda perdida.
- O cliente pode mandar áudio (vem transcrito) ou foto de pneu/lateral: leia a medida da foto se der.`;

const FERRAMENTAS: Anthropic.Tool[] = [
  {
    name: "buscar_pneus",
    description: "Procura no estoque da loja (Ômie, ao vivo) pela medida. Devolve os pneus com saldo, preço e se têm foto. " +
      "Sem a medida exata, devolve as medidas mais próximas do mesmo aro.",
    input_schema: {
      type: "object",
      properties: {
        medida: { type: "string", description: "Medida como o cliente mandou, ex.: \"205/40 R17\", \"205 40 17\", \"265/65R17\". Vazio para buscar por texto." },
        texto: { type: "string", description: "Opcional: marca ou modelo (\"XBRI\", \"A/T\"), ou busca livre quando não há medida." },
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
    description: "Passa a conversa para o vendedor, em silêncio, com um resumo para ele continuar sem perguntar de novo. Depois disso você para de responder este cliente.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Por que transferiu: desconto insistente, frete/entrega, fora do roteiro..." },
        resumo: { type: "string", description: "Pneu(s) e medida, quantidade, valores mostrados, pagamento, o que o cliente quer e o que falta." },
      },
      required: ["motivo", "resumo"],
    },
  },
];

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
    return { conteudo: enviados.length ? `Enviado para o cliente: ${enviados.join("; ")}` : "Nenhum código válido; faça buscar_pneus antes." };
  }

  if (nome === "transferir_vendedor") {
    await ctx.aoTransferir(String(input.motivo || ""), String(input.resumo || ""));
    return { conteudo: "Transferido. Mande no máximo uma frase curta de espera (ou nada) e encerre.", transferiu: true };
  }

  return { conteudo: `Ferramenta desconhecida: ${nome}` };
}

function agoraTexto() {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short" }).format(new Date());
}

/**
 * Um turno de atendimento. Texto que a IA escreve antes de usar uma ferramenta sai na hora,
 * na ordem: "Bom dia, tudo beleza?" → fotos → fechamento. Devolve o texto final (pode ser vazio).
 */
export async function atenderPneus(ctx: Contexto, historico: Anthropic.MessageParam[], conteudo: Anthropic.ContentBlockParam[], extraSistema = ""): Promise<string> {
  const sistema: Anthropic.TextBlockParam[] = [
    { type: "text", text: PERSONA_PNEUS, cache_control: { type: "ephemeral" } },
    { type: "text", text: [`Agora: ${agoraTexto()} (horário de Goiânia).`, ctx.nome ? `Nome no WhatsApp do cliente: ${ctx.nome}.` : "", extraSistema].filter(Boolean).join("\n") },
  ];
  const ult = historico[historico.length - 1];
  const mensagens: Anthropic.MessageParam[] = ult?.role === "user"
    ? [...historico.slice(0, -1), { role: "user", content: [{ type: "text", text: String(ult.content) }, ...conteudo] }]
    : [...historico, { role: "user", content: conteudo }];

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
    const textos = (r.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const usos = (r.content as any[]).filter((b) => b.type === "tool_use");
    if (r.stop_reason !== "tool_use" || !usos.length) {
      if (r.stop_reason === "pause_turn") continue;
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
      resultados.push({ type: "tool_result", tool_use_id: b.id, content: res.conteudo });
    }
    mensagens.push({ role: "user", content: resultados });
  }
  return "";
}

/** Mensagem de reengajamento curta, no tom da loja, a partir da conversa. */
export async function textoReengajamento(historico: Anthropic.MessageParam[], etapa: number): Promise<string> {
  const guia = [
    "1ª retomada (10 min sem resposta): leve, tipo \"E aí, conseguiu ver? Qualquer coisa tô por aqui\".",
    "2ª retomada (40 min): lembre o pneu/medida que ele pediu e que ainda tem no estoque, sem pressão.",
    "3ª e última retomada (3h40): curta e gentil, deixe a porta aberta (\"quando precisar é só chamar\").",
  ][etapa - 1];
  const r = await client.messages.create({
    model: config.modeloRapido,
    max_tokens: 300,
    system: `${PERSONA_PNEUS}\n\nAgora o cliente parou de responder. Escreva SÓ a mensagem de retomada, uma frase, sem aspas. ${guia}`,
    messages: [...historico.filter((m) => typeof m.content === "string"), { role: "user", content: "[sistema: o cliente não respondeu; escreva a retomada]" }] as any,
  });
  return r.content.filter((b) => b.type === "text").map((b: any) => b.text).join(" ").trim();
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
