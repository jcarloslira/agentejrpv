import { test } from "node:test";
import assert from "node:assert/strict";

import "./ambiente.js";

const { lerWebhook } = await import("../whatsapp/uazapi.js");

test("mensagem de texto da uazapi", () => {
  const m = lerWebhook({ EventType: "messages", chat: { phone: "55 82 99999-1234" }, message: { messageid: "ABC", chatid: "5582999991234@s.whatsapp.net", messageType: "Conversation", text: "oi Paloma", senderName: "Jean" } });
  assert.equal(m?.telefone, "5582999991234");
  assert.equal(m?.tipo, "texto");
  assert.equal(m?.texto, "oi Paloma");
});

test("ignora grupo e mensagem própria", () => {
  assert.equal(lerWebhook({ EventType: "messages", message: { chatid: "123@g.us", isGroup: true, text: "x" } }), null);
  assert.equal(lerWebhook({ EventType: "messages", message: { fromMe: true, chatid: "55829@s.whatsapp.net", text: "x" } }), null);
});

test("áudio e documento", () => {
  assert.equal(lerWebhook({ EventType: "messages", message: { messageid: "1", chatid: "5582999991234@s.whatsapp.net", messageType: "AudioMessage" } })?.tipo, "audio");
  const d = lerWebhook({ EventType: "messages", message: { messageid: "2", chatid: "5582999991234@s.whatsapp.net", messageType: "DocumentMessage", content: { fileName: "crlv.pdf" } } });
  assert.equal(d?.tipo, "documento");
  assert.equal(d?.nomeArquivo, "crlv.pdf");
});
