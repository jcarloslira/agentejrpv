/**
 * O raciocínio da Paloma: Claude com as ferramentas liberadas para o papel de quem fala,
 * em loop até ela ter a resposta pronta.
 */
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { q } from "../db.js";
import { PERSONA } from "./persona.js";
import { ferramentasPara, executar, acoesPendentes } from "./ferramentas.js";
import { DESCRICAO_PAPEL, type Usuario } from "./permissoes.js";
import * as memoria from "./memoria.js";
import { JANELA, resumoDaPessoa } from "./lembranca.js";

const client = new Anthropic({ apiKey: config.anthropicKey });
const MAX_PASSOS = 14;

function agoraTexto() {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: config.fuso, dateStyle: "full", timeStyle: "short" }).format(new Date());
}

/** Histórico recente em texto, alternando user/assistant como a API exige. */
// Busca pela PESSOA (usuario_id), não pelo telefone: o WhatsApp entrega o número às vezes com,
// às vezes sem o 9º dígito. Mensagens do turno atual (criadas depois de `antes`) ficam de fora.
async function historico(usuarioId: string, antes: Date): Promise<Anthropic.MessageParam[]> {
  const rows = (await q<{ papel: string; texto: string; criado_em: string }>(
    `select papel, texto, criado_em from paloma.mensagens where usuario_id=$1 and criado_em < $2
      order by criado_em desc limit $3`, [usuarioId, antes, JANELA])).reverse();
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: config.fuso, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const msgs: Anthropic.MessageParam[] = [];
  for (const r of rows) {
    const role = r.papel === "user" ? "user" : "assistant";
    // data e hora de cada mensagem: ela sabe o que mandou, quando, e o que foi a última coisa dita
    const carimbo = `[${hora.format(new Date(r.criado_em))}]`;
    const texto = r.papel === "aviso" ? `${carimbo} [mensagem que você mandou por iniciativa própria] ${r.texto}` : `${carimbo} ${r.texto}`;
    const ult = msgs[msgs.length - 1];
    if (ult && ult.role === role) ult.content = `${ult.content}\n\n${texto}`;
    else msgs.push({ role, content: texto });
  }
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

export type Entrada = {
  usuario: Usuario;
  /** blocos da mensagem atual (texto + imagens/PDF) */
  conteudo: Anthropic.ContentBlockParam[];
  inicioTurno: Date;
};

/** A conta do Claude ficou sem crédito: não adianta tentar de novo até alguém recarregar. */
export const semCredito = (e: unknown) => e instanceof Anthropic.APIError && /credit balance/i.test(String(e.message));

export async function pensar(e: Entrada): Promise<string> {
  const u = e.usuario;
  const ferramentas = ferramentasPara(u);
  const [lembrancas, pendentes, resumo] = await Promise.all([memoria.contexto(u), acoesPendentes(u.id), resumoDaPessoa(u.id)]);
  const sistema: Anthropic.TextBlockParam[] = [
    { type: "text", text: PERSONA, cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text: [
        `Agora: ${agoraTexto()} (horário de Sergipe).`,
        `Você está falando com ${u.nome}${u.apelido ? ` (chame de ${u.apelido})` : ""}, ${DESCRICAO_PAPEL[u.papel]}.`,
        u.codigo_voluntario ? `Código de voluntário no SGA: ${u.codigo_voluntario}.` : "",
        u.powercrm_email ? `E-mail no Power CRM: ${u.powercrm_email}.` : "",
        resumo,
        lembrancas,
        pendentes,
        "As mensagens do histórico vêm com [data hora] no começo só para você se situar no tempo; não escreva esse carimbo nas suas respostas.",
      ].filter(Boolean).join("\n"),
    },
  ];

  const anteriores = await historico(u.id, e.inicioTurno);
  const ult = anteriores[anteriores.length - 1];
  // se o turno anterior ficou sem resposta, junta com o atual (a API pede alternância)
  const mensagens: Anthropic.MessageParam[] = ult?.role === "user"
    ? [...anteriores.slice(0, -1), { role: "user", content: [{ type: "text", text: String(ult.content) }, ...e.conteudo] }]
    : [...anteriores, { role: "user", content: e.conteudo }];

  for (let passo = 0; passo < MAX_PASSOS; passo++) {
    const r = await client.beta.messages.create({
      model: config.modelo,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: sistema,
      tools: ferramentas,
      messages: mensagens as any,
    } as any) as any;

    await q(`insert into paloma.uso_ia (usuario_id, modelo, entrada, saida, cache_lido) values ($1,$2,$3,$4,$5)`,
      [u.id, r.model, r.usage?.input_tokens ?? 0, r.usage?.output_tokens ?? 0, r.usage?.cache_read_input_tokens ?? 0]).catch(() => {});

    if (r.stop_reason === "refusal") return "Essa eu não consigo te ajudar por aqui. Se for algo da operação, me explica de outro jeito que eu tento de novo.";

    mensagens.push({ role: "assistant", content: r.content });
    const usos = (r.content as any[]).filter((b) => b.type === "tool_use");
    if (r.stop_reason !== "tool_use" || !usos.length) {
      if (r.stop_reason === "pause_turn") continue;
      const texto = (r.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return texto || "Pronto ✅";
    }
    const resultados = await Promise.all(usos.map(async (b: any) => {
      const { conteudo, erro } = await executar({ usuario: u, inicioTurno: e.inicioTurno }, b.name, b.input);
      return { type: "tool_result", tool_use_id: b.id, content: conteudo, is_error: erro } as Anthropic.ToolResultBlockParam;
    }));
    mensagens.push({ role: "user", content: resultados });
  }
  return "Fiz bastante coisa aqui mas não consegui fechar tudo de uma vez. Me diz o que ficou faltando que eu continuo.";
}

/** Chamada rápida e barata: descrever um arquivo recebido, para guardar junto dele. */
export async function descreverArquivo(bloco: Anthropic.ContentBlockParam): Promise<string> {
  const r = await client.messages.create({
    model: config.modeloRapido,
    max_tokens: 400,
    messages: [{ role: "user", content: [bloco, { type: "text", text: "Descreva em até 2 frases o que é este arquivo (tipo de documento ou foto, de quem/qual veículo, dados principais visíveis como nome, placa, validade). Sem CPF completo." }] }],
  });
  return r.content.filter((b) => b.type === "text").map((b: any) => b.text).join(" ").trim();
}
