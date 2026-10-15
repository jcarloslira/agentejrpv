/**
 * Espelho do Power CRM no schema paloma: a Power API não lista cotações por consultor,
 * então puxamos o relatório da base (/api/report/db) por data de atualização.
 */
import { q, um } from "../db.js";
import { powercrm } from "../integracoes/powercrm.js";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function dataPower(s: unknown): string | null {
  // "14/10/2026 - 05:56" → ISO com fuso de Alagoas
  const m = String(s ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s*-\s*(\d{2}):(\d{2}))?/);
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? "00"}:${m[5] ?? "00"}:00-03:00` : null;
}

export async function gravarCotacoes(linhas: any[]) {
  let n = 0;
  for (const c of linhas) {
    if (!c?.quotationCode) continue;
    await q(
      `insert into paloma.pcrm_cotacoes (quotation_code, cliente_nome, cliente_cpf, cliente_celular, placa, consultor_nome, consultor_email, cooperativa, card_status, arquivada, criado_no_crm, dados, atualizado_em)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
       on conflict (quotation_code) do update set cliente_nome=excluded.cliente_nome, cliente_cpf=excluded.cliente_cpf, cliente_celular=excluded.cliente_celular,
         placa=excluded.placa, consultor_nome=excluded.consultor_nome, consultor_email=excluded.consultor_email, cooperativa=excluded.cooperativa,
         card_status=excluded.card_status, arquivada=excluded.arquivada, criado_no_crm=excluded.criado_no_crm, dados=excluded.dados, atualizado_em=now()`,
      [
        String(c.quotationCode), c.clientName || null, String(c.clientRegistration || "").replace(/\D/g, "") || null, c.clientMobile || c.clientPhone || null,
        String(c.vehiclePlates || "").toUpperCase().replace(/[^A-Z0-9]/g, "") || null, c.responsibleSalesman || null, (c.responsibleSalesmanEmail || "").toLowerCase() || null,
        c.cooperative || null, c.cardStatus != null ? String(c.cardStatus) : null, !!c.isShelved && c.isShelved !== "N", dataPower(c.createdDate), JSON.stringify(c),
      ]);
    n++;
  }
  return n;
}

/** Puxa o que mudou desde o último ciclo (com 1 dia de folga). Na primeira vez, os últimos `diasIniciais`. */
export async function sincronizar(diasIniciais = 180) {
  const ctl = await um<{ valor: any }>(`select valor from paloma.config where chave='pcrm_sync'`);
  const hoje = new Date();
  const desde = ctl?.valor?.ate ? new Date(new Date(ctl.valor.ate).getTime() - 86400e3) : new Date(hoje.getTime() - diasIniciais * 86400e3);
  let total = 0;
  // janelas de 15 dias para não estourar a resposta
  for (let ini = new Date(desde); ini <= hoje; ini = new Date(ini.getTime() + 15 * 86400e3)) {
    const fim = new Date(Math.min(ini.getTime() + 14 * 86400e3, hoje.getTime()));
    for (const tipo of ["1", "2"]) { // 1 = criadas no período, 2 = atualizadas no período
      const linhas = await powercrm("POST", "/api/report/db", { corpo: { from: iso(ini), to: iso(fim), stringFilterTypeDate: tipo } });
      total += await gravarCotacoes(Array.isArray(linhas) ? linhas : []);
    }
  }
  await q(`insert into paloma.config (chave, valor) values ('pcrm_sync', $1) on conflict (chave) do update set valor=excluded.valor, atualizado_em=now()`,
    [JSON.stringify({ ate: iso(hoje), em: new Date().toISOString(), registros: total })]);
  return total;
}
