import { test } from "node:test";
import assert from "node:assert/strict";
import "./ambiente.js";

const { bolhas } = await import("../atendimento.js");
const { lerWebhook } = await import("../whatsapp/uazapi.js");
const { descreverCitacao } = await import("../agente/lembranca.js");

test("resposta curta vai numa bolha só; longa vira até 3", () => {
  assert.equal(bolhas("Oi, tudo certo!").length, 1);
  const longa = Array.from({ length: 8 }, (_, i) => `Parágrafo ${i} ` + "x".repeat(180)).join("\n\n");
  const b = bolhas(longa);
  assert.ok(b.length >= 2 && b.length <= 3, `veio ${b.length}`);
  assert.equal(b.join("\n\n").replace(/\s+/g, ""), longa.replace(/\s+/g, "")); // nada se perde
});

test("reply do WhatsApp: pega o id e o texto da mensagem marcada", () => {
  const m = lerWebhook({ EventType: "messages", chat: { phone: "5579999334475" }, message: {
    messageid: "ABC", chatid: "5579999334475@s.whatsapp.net", messageType: "ExtendedTextMessage", text: "e essa aqui?",
    quoted: "3EB044EC7404A6B951A3EA", content: { contextInfo: { stanzaID: "3EB044EC7404A6B951A3EA", quotedMessage: { conversation: "Resumo de ontem…" } } } } });
  assert.equal(m?.citadaId, "3EB044EC7404A6B951A3EA");
  assert.equal(m?.citada, "Resumo de ontem…");
});

test("citação achada no histórico vai inteira, com data e autor", () => {
  const u: any = { nome: "Guilherme" };
  const d = descreverCitacao(u, { papel: "assistant", texto: "Bom dia! Ontem: 36 vendas.", criado_em: "2026-10-28T11:01:04Z" }, null);
  assert.match(d, /VOCÊ \(Paloma\)/);
  assert.match(d, /28\/10/);
  assert.match(d, /36 vendas/);
});
