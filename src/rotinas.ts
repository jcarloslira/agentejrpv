/**
 * O que a Paloma faz por conta própria.
 *  - Resumo da manhã (8h, segunda a sábado) para quem tem resumo_diario ligado.
 *    Padrão: ligado para gerência, diretoria e admin; desligado para os demais.
 */
import { q } from "./db.js";
import { config } from "./config.js";
import { pensar } from "./agente/cerebro.js";
import { mandarPorConta } from "./atendimento.js";
import type { Usuario } from "./agente/permissoes.js";

function agoraLocal() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: config.fuso, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), minuto: Number(p.minute), domingo: p.weekday === "Sun" };
}

const PEDIDO_RESUMO = `[rotina automática das 8h — não é mensagem da pessoa]
Monte o resumo da manhã para esta pessoa, de acordo com o papel dela, e responda só com o texto que será enviado no WhatsApp.
Use as ferramentas para buscar os números de ONTEM (e da semana até ontem, se ajudar): cotações criadas, vendas enviadas ao SGA, destaques por consultor ou cooperativa, cotações paradas em vistoria ou liberadas para cadastro há mais de 2 dias.
Para gerência/diretoria: inclua também 1 ou 2 alertas da operação, se houver (inadimplência, eventos parados, queda de vendas).
Formato: saudação curta, 3 a 6 linhas com os números, no máximo 2 alertas, e uma pergunta final oferecendo detalhar. Não invente número: se uma consulta falhar, deixe de fora.`;

async function resumoDaManha() {
  const { data, hora, minuto, domingo } = agoraLocal();
  if (domingo || hora !== 8 || minuto > 20) return;
  const pessoas = await q<Usuario>(
    `select * from paloma.usuarios u where ativo
       and coalesce((preferencias->>'resumo_diario')::boolean, papel in ('gerencia','diretoria','admin'))
       and not exists (select 1 from paloma.config c where c.chave = 'resumo:' || $1 || ':' || u.id)`, [data]);
  for (const u of pessoas) {
    // marca antes de enviar: se o servidor reiniciar no meio, não manda em dobro
    const marcou = await q(`insert into paloma.config (chave, valor) values ($1, '{}'::jsonb) on conflict do nothing returning chave`, [`resumo:${data}:${u.id}`]);
    if (!marcou.length) continue;
    try {
      const texto = await pensar({ usuario: u, conteudo: [{ type: "text", text: PEDIDO_RESUMO }], inicioTurno: new Date() });
      await mandarPorConta(u, texto);
    } catch (e) {
      console.error("resumo da manhã", u.nome, e);
    }
  }
}

export function iniciarRotinas() {
  setInterval(() => { resumoDaManha().catch((e) => console.error("rotinas", e)); }, 60e3);
}
