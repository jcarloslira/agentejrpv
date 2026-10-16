/**
 * Servidor da Paloma.
 *   POST /webhook/whatsapp/:segredo   mensagens da uazapi
 *   POST /webhook/powercrm/:segredo   webhooks v2 do Power CRM
 *   GET  /saude                       status
 *   /admin/*                          administração (header x-admin-token ou ?token= no navegador)
 */
import Fastify from "fastify";
import { timingSafeEqual } from "node:crypto";
import { config, faltando } from "./config.js";
import { q, pool } from "./db.js";
import { enfileirar, garantirAdmin } from "./atendimento.js";
import * as wa from "./whatsapp/uazapi.js";
import { sincronizar, gravarCotacoes } from "./sync/powercrm.js";
import { listarVozes, vozLigada } from "./voz/elevenlabs.js";
import { powercrm } from "./integracoes/powercrm.js";

const app = Fastify({ logger: { level: "info" }, bodyLimit: 30 * 1024 * 1024 });

const igual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// sempre 200 (o Render só precisa saber que o processo está de pé); o corpo diz o que falta
app.get("/saude", async () => {
  const banco = await q(`select current_user usuario, (select count(*) from paloma.usuarios)::int usuarios`)
    .then((r) => ({ ok: true, ...r[0] })).catch((e) => ({ ok: false, erro: (e as Error).message }));
  const whatsapp = await wa.status().catch((e) => ({ erro: (e as Error).message }));
  return { ok: banco.ok && !faltando.length, variaveis_faltando: faltando, banco, whatsapp, voz: await vozLigada() };
});

app.post<{ Params: { segredo: string } }>("/webhook/whatsapp/:segredo", async (req, rep) => {
  if (!igual(req.params.segredo, config.webhookSegredo)) return rep.code(403).send();
  const m = wa.lerWebhook(req.body);
  if (m) enfileirar(m);
  return { ok: true };
});

app.post<{ Params: { segredo: string } }>("/webhook/powercrm/:segredo", async (req, rep) => {
  if (!igual(req.params.segredo, config.webhookSegredo)) return rep.code(403).send();
  // responde 200 na hora: erro na resposta faz o Power desativar o webhook
  const corpo: any = req.body ?? {};
  q(`insert into paloma.pcrm_webhooks (evento, payload) values ($1,$2)`, [corpo.event || corpo.type || corpo.status || null, JSON.stringify(corpo)])
    .then(async () => {
      const codigo = corpo.quotationCode || corpo.data?.quotationCode;
      if (!codigo) return;
      // atualiza o espelho com o relatório do dia (traz a cotação completa)
      const hoje = new Date().toISOString().slice(0, 10);
      const linhas = await powercrm("POST", "/api/report/db", { corpo: { from: hoje, to: hoje, stringFilterTypeDate: "2" } });
      await gravarCotacoes((Array.isArray(linhas) ? linhas : []).filter((l: any) => String(l.quotationCode) === String(codigo)));
    })
    .catch((e) => app.log.error(e, "webhook powercrm"));
  return { ok: true };
});

// ---------- administração ----------
app.addHook("onRequest", async (req, rep) => {
  if (!req.url.startsWith("/admin")) return;
  const t = String(req.headers["x-admin-token"] || (req.query as any)?.token || "");
  if (!t || !igual(t, config.adminToken)) return rep.code(401).send({ erro: "não autorizado" });
});

app.get("/admin/whatsapp/instancias", async () => wa.listarInstancias());

/** Cria/reaproveita a instância da Paloma, aponta o webhook e devolve o QR Code (base64). */
app.post("/admin/whatsapp/conectar", async (req) => {
  const base = config.urlPublica || `https://${req.headers.host}`;
  return wa.conectar(`${base}/webhook/whatsapp/${config.webhookSegredo}`);
});

/** Página simples com o QR Code para escanear no celular. */
app.get("/admin/whatsapp/qr", async (req, rep) => {
  const base = config.urlPublica || `https://${req.headers.host}`;
  const r = await wa.conectar(`${base}/webhook/whatsapp/${config.webhookSegredo}`);
  const corpo = r.conectado
    ? `<p>✅ WhatsApp da Paloma conectado no número <b>${r.numero}</b>.</p>`
    : r.qrcode ? `<p>Abra o WhatsApp do número da Paloma → Aparelhos conectados → Conectar aparelho, e escaneie:</p><img src="${r.qrcode}" style="width:320px;height:320px"><p>O código expira em ~40s. Recarregue a página se precisar.</p>`
    : `<p>Sem QR Code no momento. Recarregue em alguns segundos.</p>`;
  rep.type("text/html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Paloma · WhatsApp</title><body style="font-family:system-ui;padding:24px;max-width:480px;margin:auto">${corpo}</body>`);
});

app.get("/admin/voz/vozes", async () => listarVozes());

app.post("/admin/powercrm/sincronizar", async () => ({ registros: await sincronizar() }));

app.get("/admin/usuarios", async () => q(`select id, nome, apelido, telefone, papel, codigo_voluntario, powercrm_email, ativo from paloma.usuarios order by papel, nome`));

app.post<{ Body: any }>("/admin/usuarios", async (req, rep) => {
  const b: any = req.body || {};
  const tel = String(b.telefone || "").replace(/\D/g, "");
  if (!b.nome || !b.papel || tel.length < 12) return rep.code(400).send({ erro: "nome, papel e telefone (com 55 e DDD) são obrigatórios" });
  const [u] = await q(
    `insert into paloma.usuarios (nome, apelido, telefone, papel, codigo_voluntario, powercrm_email, codigo_regional) values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (telefone) do update set nome=excluded.nome, apelido=excluded.apelido, papel=excluded.papel, codigo_voluntario=excluded.codigo_voluntario,
       powercrm_email=excluded.powercrm_email, codigo_regional=excluded.codigo_regional, ativo=true returning *`,
    [b.nome, b.apelido || null, tel, b.papel, b.codigo_voluntario ?? null, b.powercrm_email || null, b.codigo_regional ?? null]);
  return u;
});

// ---------- rotinas ----------
async function cicloPowerCrm() {
  try {
    const n = await sincronizar();
    app.log.info({ registros: n }, "power crm sincronizado");
  } catch (e) {
    app.log.error(e, "sincronização power crm");
  }
}

async function iniciar() {
  // sobe mesmo com algo faltando, para o /saude mostrar o problema em vez de o deploy falhar calado
  await app.listen({ port: config.porta, host: "0.0.0.0" });
  if (faltando.length) app.log.error(`Variáveis de ambiente faltando: ${faltando.join(", ")}`);
  await garantirAdmin().catch((e) => app.log.error(e, "banco: não consegui conectar (confira DATABASE_URL)"));
  if (!faltando.includes("POWERCRM_TOKEN")) {
    cicloPowerCrm();
    setInterval(cicloPowerCrm, 15 * 60e3);
  }
}

iniciar().catch((e) => {
  console.error(e);
  process.exit(1);
});

for (const sinal of ["SIGTERM", "SIGINT"]) process.on(sinal, () => { app.close().then(() => pool.end()).finally(() => process.exit(0)); });
