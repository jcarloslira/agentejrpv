/**
 * Ferramentas da Paloma. Cada uma declara o papel mínimo e, para consultor, o recorte
 * (só o que é dele). Ferramentas que gravam no SGA ou no Power CRM NÃO executam:
 * criam uma ação pendente que só roda com confirmar_acao numa mensagem seguinte.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { q, um, pool } from "../db.js";
import { sga, dataBR, rotaDoCatalogo, rotaSgaGrava, rotasSga } from "../integracoes/sga.js";
import { powercrm, rotasPowerCrm, COLUNAS_FUNIL, STATUS_CARD } from "../integracoes/powercrm.js";
import { pode, rotaSgaRestritaDiretoria, SemPermissao, type Papel, type Usuario } from "./permissoes.js";
import * as memoria from "./memoria.js";
import { enviarTexto } from "../whatsapp/uazapi.js";

export type Contexto = {
  usuario: Usuario;
  /** quando chegou a mensagem atual: ação pendente criada depois disso não pode ser confirmada neste turno */
  inicioTurno: Date;
};

type Resultado = string | Anthropic.ToolResultBlockParam["content"];

type Ferramenta = {
  nome: string;
  descricao: string;
  esquema: Anthropic.Tool["input_schema"];
  papel: Papel;
  executar: (ctx: Contexto, entrada: any) => Promise<Resultado>;
};

const json = (x: unknown, max = 12000) => {
  const s = JSON.stringify(x, null, 1);
  return s.length > max ? s.slice(0, max) + `\n…(cortado: ${s.length} caracteres no total; refine a consulta)` : s;
};
const placaLimpa = (p: string) => String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const digitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

// ---------- recorte do consultor ----------

async function garantirVeiculoDoConsultor(u: Usuario, placa: string) {
  if (pode(u, "cadastro")) return;
  if (!u.codigo_voluntario) throw new SemPermissao("Seu cadastro na Paloma ainda não tem o código de voluntário do SGA; peça para a gerência vincular.");
  const v = await um(`select codigo_voluntario from public.jrpv_veiculos where upper(placa)=$1 or upper(chassi)=$1 order by atualizado_em desc limit 1`, [placaLimpa(placa)]);
  if (!v) throw new SemPermissao("Não achei essa placa na sua carteira.");
  if (Number(v.codigo_voluntario) !== Number(u.codigo_voluntario)) throw new SemPermissao("Essa placa não é da sua carteira, então não posso abrir os dados dela pra você.");
}

async function garantirAssociadoDoConsultor(u: Usuario, cpfOuCodigo: string) {
  if (pode(u, "cadastro")) return;
  const d = digitos(cpfOuCodigo);
  const v = await um(
    `select 1 from public.jrpv_veiculos where codigo_voluntario=$1 and (regexp_replace(coalesce(cpf_associado,''),'\\D','','g')=$2 or codigo_associado::text=$2) limit 1`,
    [u.codigo_voluntario ?? -1, d],
  );
  if (!v) throw new SemPermissao("Esse associado não está na sua carteira.");
}

async function garantirCotacaoDoConsultor(u: Usuario, codigo: string) {
  if (pode(u, "cadastro")) return;
  const c = await um(`select consultor_email from paloma.pcrm_cotacoes where quotation_code=$1`, [codigo]);
  if (!c) throw new SemPermissao("Não achei essa cotação no seu nome (se acabou de ser criada, espere uns minutos).");
  if (!u.powercrm_email || String(c.consultor_email || "").toLowerCase() !== u.powercrm_email.toLowerCase())
    throw new SemPermissao("Essa cotação é de outro consultor.");
}

// ---------- ações pendentes ----------

async function prepararAcao(ctx: Contexto, sistema: "sga" | "powercrm", metodo: string, rota: string, corpo: unknown, resumo: string) {
  await q(`update paloma.acoes set status='expirada' where usuario_id=$1 and status='pendente' and criado_em < now() - interval '30 minutes'`, [ctx.usuario.id]);
  const [a] = await q<{ id: string }>(
    `insert into paloma.acoes (usuario_id, sistema, metodo, rota, corpo, resumo) values ($1,$2,$3,$4,$5,$6) returning id`,
    [ctx.usuario.id, sistema, metodo, rota, corpo === undefined ? null : JSON.stringify(corpo), resumo],
  );
  return `AÇÃO PENDENTE (id ${a.id}). Nada foi gravado ainda. Mostre para a pessoa, em poucas linhas, o que vai ser feito:\n${resumo}\nE pergunte se pode fazer. Só chame confirmar_acao depois que ela confirmar numa nova mensagem.`;
}

async function executarAcao(acao: any): Promise<unknown> {
  const corpo = acao.corpo ?? undefined;
  if (acao.sistema === "sga") return sga(acao.metodo, acao.rota, corpo);
  // powercrm: corpo guarda {query, corpo, arquivo_id}
  const c = corpo || {};
  let binario: { dados: Buffer; mime: string } | undefined;
  if (c.arquivo_id) {
    const arq = await um(`select conteudo, mime from paloma.arquivos where id=$1`, [c.arquivo_id]);
    if (!arq) throw new Error("O arquivo dessa ação não existe mais.");
    binario = { dados: arq.conteudo, mime: arq.mime };
  }
  return powercrm(acao.metodo, acao.rota, { query: c.query, corpo: c.corpo, binario });
}

// ---------- catálogo ----------

const F: Ferramenta[] = [
  // ===== consultas SGA =====
  {
    nome: "veiculo_consultar",
    descricao: "Consulta um veículo no SGA pela placa ou chassi: dados do veículo e do associado, situação, produtos e a situação financeira (boletos em aberto). Use sempre que falarem de uma placa.",
    papel: "consultor",
    esquema: { type: "object", properties: { placa_ou_chassi: { type: "string" } }, required: ["placa_ou_chassi"] },
    async executar(ctx, e) {
      const chave = placaLimpa(e.placa_ou_chassi);
      await garantirVeiculoDoConsultor(ctx.usuario, chave);
      const [veiculo, financeiro, situacao] = await Promise.allSettled([
        sga("GET", `veiculo/buscar/${chave}`),
        sga("GET", `buscar/situacao-financeira-veiculo/${chave}`),
        sga("GET", `buscar/situacao-veiculo/${chave}`),
      ]);
      const val = (r: PromiseSettledResult<any>) => (r.status === "fulfilled" ? r.value : { erro: (r.reason as Error).message });
      return json({ veiculo: val(veiculo), situacao: val(situacao), situacao_financeira: val(financeiro) });
    },
  },
  {
    nome: "associado_consultar",
    descricao: "Consulta um associado no SGA por CPF/CNPJ ou código, e traz o histórico de atendimentos dele.",
    papel: "consultor",
    esquema: { type: "object", properties: { cpf_ou_codigo: { type: "string" }, tipo: { type: "string", enum: ["cpf", "codigo"] } }, required: ["cpf_ou_codigo", "tipo"] },
    async executar(ctx, e) {
      await garantirAssociadoDoConsultor(ctx.usuario, e.cpf_ou_codigo);
      const valor = e.tipo === "cpf" ? digitos(e.cpf_ou_codigo) : e.cpf_ou_codigo;
      const associado = await sga("GET", `associado/buscar/${valor}/${e.tipo}`);
      let historico: unknown = null;
      if (e.tipo === "cpf") historico = await sga("GET", `buscar/historico-atendimento-associado/${valor}`).catch((x) => ({ erro: x.message }));
      return json({ associado, historico_atendimento: historico });
    },
  },
  {
    nome: "eventos_do_veiculo",
    descricao: "Lista os eventos (sinistros) de um veículo no SGA, com situação e valores.",
    papel: "consultor",
    esquema: { type: "object", properties: { placa: { type: "string" } }, required: ["placa"] },
    async executar(ctx, e) {
      await garantirVeiculoDoConsultor(ctx.usuario, e.placa);
      return json(await sga("GET", `listar/evento-veiculo/${placaLimpa(e.placa)}`));
    },
  },
  {
    nome: "boletos_do_veiculo",
    descricao: "Boletos de um veículo (pela placa): vencimento, valor, situação, pagamento. Vem do espelho do SGA atualizado a cada ~10 min.",
    papel: "consultor",
    esquema: { type: "object", properties: { placa: { type: "string" }, somente_abertos: { type: "boolean" } }, required: ["placa"] },
    async executar(ctx, e) {
      await garantirVeiculoDoConsultor(ctx.usuario, e.placa);
      const rows = await q(
        `select b.nosso_numero, b.mes_referente, b.data_vencimento, b.valor_boleto, b.descricao_situacao_boleto situacao, b.data_pagamento, b.valor_pagamento
           from public.jrpv_boletos b join public.jrpv_veiculos v on v.codigo_associado=b.codigo_associado
          where upper(v.placa)=$1 ${e.somente_abertos ? "and b.data_pagamento is null" : ""}
          order by b.data_vencimento desc limit 24`, [placaLimpa(e.placa)]);
      return json({ fonte: "espelho do SGA (pode ter até ~10 min de atraso)", boletos: rows });
    },
  },
  {
    nome: "minha_carteira",
    descricao: "Resumo da carteira de um consultor: veículos por situação, novos no mês e lista de placas. Consultor vê a própria; cadastro/gerência pode informar codigo_voluntario.",
    papel: "consultor",
    esquema: { type: "object", properties: { codigo_voluntario: { type: "integer" }, situacao: { type: "string", description: "filtra a lista por situação (ex.: ATIVO, INADIMPLENTE)" } } },
    async executar(ctx, e) {
      const cod = pode(ctx.usuario, "cadastro") && e.codigo_voluntario ? e.codigo_voluntario : ctx.usuario.codigo_voluntario;
      if (!cod) return "Não sei qual é o código de voluntário. Peça para a gerência vincular no cadastro da Paloma, ou informe o código.";
      const resumo = await q(`select descricao_situacao situacao, count(*)::int qtd from public.jrpv_veiculos where codigo_voluntario=$1 group by 1 order by 2 desc`, [cod]);
      const novos = await um(`select count(*)::int qtd from public.jrpv_veiculos where codigo_voluntario=$1 and data_contrato >= date_trunc('month', now())`, [cod]);
      const lista = await q(
        `select placa, nome_associado, marca, modelo, descricao_situacao situacao, data_contrato::date
           from public.jrpv_veiculos where codigo_voluntario=$1 ${e.situacao ? "and descricao_situacao ilike $2" : ""}
          order by data_contrato desc nulls last limit 60`, e.situacao ? [cod, `%${e.situacao}%`] : [cod]);
      return json({ codigo_voluntario: cod, por_situacao: resumo, novos_no_mes: novos?.qtd ?? 0, veiculos: lista });
    },
  },

  // ===== Power CRM =====
  {
    nome: "cotacao_buscar",
    descricao: "Procura cotações no Power CRM por placa, nome, CPF, telefone ou código. Consultor só encontra as dele. Traz etapa do funil, valores, plano e datas.",
    papel: "consultor",
    esquema: { type: "object", properties: { termo: { type: "string" } }, required: ["termo"] },
    async executar(ctx, e) {
      const t = String(e.termo).trim();
      const d = digitos(t), p = placaLimpa(t);
      const filtroConsultor = pode(ctx.usuario, "cadastro") ? "" : "and lower(consultor_email)=lower($2)";
      const rows = await q(
        `select quotation_code, cliente_nome, placa, consultor_nome, cooperativa, card_status, arquivada, criado_no_crm, atualizado_em,
                dados->>'namePlan' plano, dados->>'monthlyPaymentsPrice' mensalidade, dados->>'acquisitionPrice' adesao,
                dados->>'vehicleModel' modelo, dados->>'vehicleFipeValue' fipe, dados->>'statusInspection' vistoria, dados->>'sentToHinovaDate' enviado_sga
           from paloma.pcrm_cotacoes
          where (quotation_code=$1 or upper(placa)=upper($1) or cliente_cpf=regexp_replace($1,'\\D','','g')
                 or right(regexp_replace(coalesce(cliente_celular,''),'\\D','','g'),8)=right(regexp_replace($1,'\\D','','g'),8) and length(regexp_replace($1,'\\D','','g'))>=8
                 or cliente_nome ilike '%'||$1||'%') ${filtroConsultor}
          order by criado_no_crm desc nulls last limit 15`,
        filtroConsultor ? [p.length === 7 ? p : d.length >= 8 ? d : t, ctx.usuario.powercrm_email || "-"] : [p.length === 7 ? p : d.length >= 8 ? d : t]);
      const comEtapa = rows.map((r: any) => ({ ...r, etapa: STATUS_CARD[r.card_status] || r.card_status }));
      return json({ fonte: "espelho do Power CRM", cotacoes: comEtapa });
    },
  },
  {
    nome: "cotacao_detalhar",
    descricao: "Abre uma cotação do Power CRM ao vivo: dados completos, planos disponíveis com valores e FIPE.",
    papel: "consultor",
    esquema: { type: "object", properties: { codigo: { type: "string" } }, required: ["codigo"] },
    async executar(ctx, e) {
      await garantirCotacaoDoConsultor(ctx.usuario, e.codigo);
      const [cot, planos, fipe] = await Promise.allSettled([
        powercrm("GET", `/api/quotation/${encodeURIComponent(e.codigo)}`),
        powercrm("GET", "/api/quotation/plansQuotation", { query: { quotationCode: e.codigo } }),
        powercrm("GET", "/api/quotation/quotationFipeApi", { query: { quotationCode: e.codigo } }),
      ]);
      const val = (r: PromiseSettledResult<any>) => (r.status === "fulfilled" ? r.value : { erro: (r.reason as Error).message });
      return json({ cotacao: val(cot), planos: val(planos), fipe: val(fipe) });
    },
  },
  {
    nome: "cotacao_criar",
    descricao: "Prepara a criação de uma cotação no Power CRM em nome do consultor que está falando (ou do consultor informado por cadastro/gerência). Gera ação pendente.",
    papel: "consultor",
    esquema: {
      type: "object",
      properties: {
        nome: { type: "string" }, telefone: { type: "string" }, email: { type: "string" }, placa: { type: "string" }, cpf: { type: "string" },
        veiculo_trabalho: { type: "boolean" }, email_consultor: { type: "string", description: "só cadastro/gerência: cria em nome de outro consultor" },
      },
      required: ["nome", "telefone"],
    },
    async executar(ctx, e) {
      const emailConsultor = pode(ctx.usuario, "cadastro") && e.email_consultor ? e.email_consultor : ctx.usuario.powercrm_email;
      let pwrlnk: string | undefined;
      if (emailConsultor) {
        const pl = await powercrm("POST", "/api/consultant/powerlink", { corpo: { email: emailConsultor } }).catch(() => null);
        pwrlnk = pl?.powerLink || pl?.powerlink || pl?.pwrlnk || pl?.link || undefined;
      }
      const corpo = { name: e.nome, phone: digitos(e.telefone), email: e.email, plts: e.placa ? placaLimpa(e.placa) : undefined, registration: e.cpf ? digitos(e.cpf) : undefined, workVehicle: !!e.veiculo_trabalho, pwrlnk };
      return prepararAcao(ctx, "powercrm", "POST", "/api/quotation/add", { corpo },
        `Criar cotação no Power CRM: ${e.nome}, tel ${e.telefone}${e.placa ? `, placa ${placaLimpa(e.placa)}` : ""}${emailConsultor ? `, consultor ${emailConsultor}` : ""}${pwrlnk ? "" : " (sem PowerLink: o Power vai atribuir pelo padrão)"}.`);
    },
  },
  {
    nome: "cotacao_atualizar",
    descricao: "Prepara alteração de dados de uma cotação no Power CRM (dados pessoais, endereço, veículo, plano tppId, dia de vencimento, observações do contrato). Campos no formato da API: name, fullName, email, phoneMobile1, registration (CPF), rg, birthdate, cnh, addressZipcode, addressAddress, addressNumber, addressNeighborhood, plates, chassi, renavam, color, kmtr, tppId, expirationDay, noteContract, protectedValue. Gera ação pendente.",
    papel: "consultor",
    esquema: { type: "object", properties: { codigo: { type: "string" }, campos: { type: "object", additionalProperties: true } }, required: ["codigo", "campos"] },
    async executar(ctx, e) {
      await garantirCotacaoDoConsultor(ctx.usuario, e.codigo);
      const corpo = { ...e.campos, code: e.codigo };
      return prepararAcao(ctx, "powercrm", "POST", "/api/quotation/update", { corpo },
        `Atualizar a cotação ${e.codigo}: ${Object.entries(e.campos).map(([k, v]) => `${k} = ${v}`).join("; ")}.`);
    },
  },
  {
    nome: "cotacao_mover_etapa",
    descricao: "Prepara mover o card da cotação no funil do Power CRM. Etapas: RECEIVED (recebida), IN_NEGOTIATION (em negociação), INSPECTION (vistoria), RELEASED_FOR_REGISTRATION (liberada para cadastro), COMPLETED (concluída).",
    papel: "consultor",
    esquema: { type: "object", properties: { codigo: { type: "string" }, etapa: { type: "string", enum: [...COLUNAS_FUNIL] } }, required: ["codigo", "etapa"] },
    async executar(ctx, e) {
      await garantirCotacaoDoConsultor(ctx.usuario, e.codigo);
      if (e.etapa === "COMPLETED" && !pode(ctx.usuario, "cadastro")) throw new SemPermissao("Concluir a cotação é com o setor de cadastro.");
      return prepararAcao(ctx, "powercrm", "POST", "/api/quotation/card/move", { query: { quotationCode: e.codigo, cardColumn: e.etapa } },
        `Mover a cotação ${e.codigo} para a etapa ${e.etapa}.`);
    },
  },
  {
    nome: "cotacao_observacao",
    descricao: "Prepara registrar uma observação na cotação do Power CRM.",
    papel: "consultor",
    esquema: { type: "object", properties: { codigo: { type: "string" }, observacao: { type: "string" } }, required: ["codigo", "observacao"] },
    async executar(ctx, e) {
      await garantirCotacaoDoConsultor(ctx.usuario, e.codigo);
      return prepararAcao(ctx, "powercrm", "POST", "/api/quotation/send-observation", { query: { quotationCode: e.codigo, observation: e.observacao } },
        `Registrar na cotação ${e.codigo} a observação: "${e.observacao}".`);
    },
  },
  {
    nome: "cotacao_anexar",
    descricao: "Prepara anexar à cotação do Power CRM um arquivo recebido pelo WhatsApp (use o arquivo_id informado na mensagem).",
    papel: "consultor",
    esquema: { type: "object", properties: { codigo: { type: "string" }, arquivo_id: { type: "string" } }, required: ["codigo", "arquivo_id"] },
    async executar(ctx, e) {
      await garantirCotacaoDoConsultor(ctx.usuario, e.codigo);
      const a = await um(`select nome, mime, descricao from paloma.arquivos where id=$1 and (usuario_id=$2 or $3)`, [e.arquivo_id, ctx.usuario.id, pode(ctx.usuario, "cadastro")]);
      if (!a) return "Não achei esse arquivo.";
      return prepararAcao(ctx, "powercrm", "POST", "/api/quotation/send-attachment", { query: { quotationCode: e.codigo }, arquivo_id: e.arquivo_id },
        `Anexar na cotação ${e.codigo} o arquivo ${a.nome || a.mime}${a.descricao ? ` (${a.descricao.slice(0, 80)})` : ""}.`);
    },
  },
  {
    nome: "vistoria_abrir",
    descricao: "Prepara abrir a vistoria (inspeção) de uma cotação no Power CRM.",
    papel: "consultor",
    esquema: { type: "object", properties: { codigo: { type: "string" }, observacao: { type: "string" } }, required: ["codigo"] },
    async executar(ctx, e) {
      await garantirCotacaoDoConsultor(ctx.usuario, e.codigo);
      return prepararAcao(ctx, "powercrm", "POST", "/api/quotation/open-inspection", { corpo: { quotationCode: e.codigo, observation: e.observacao || "" } },
        `Abrir vistoria na cotação ${e.codigo}${e.observacao ? ` com a observação "${e.observacao}"` : ""}.`);
    },
  },
  {
    nome: "vistoria_enviar_foto",
    descricao: "Prepara enviar para a vistoria (inspectionId) do Power CRM uma foto recebida pelo WhatsApp.",
    papel: "consultor",
    esquema: { type: "object", properties: { inspection_id: { type: "string" }, arquivo_id: { type: "string" } }, required: ["inspection_id", "arquivo_id"] },
    async executar(ctx, e) {
      return prepararAcao(ctx, "powercrm", "POST", "/api/quotation/send-photo", { query: { inspectionId: e.inspection_id }, arquivo_id: e.arquivo_id },
        `Enviar a foto ${e.arquivo_id.slice(0, 8)} para a vistoria ${e.inspection_id}.`);
    },
  },
  {
    nome: "cotacao_agendar_atividade",
    descricao: "Prepara agendar uma atividade (tarefa) na cotação do Power CRM. type 2 = ligação.",
    papel: "consultor",
    esquema: { type: "object", properties: { codigo: { type: "string" }, descricao: { type: "string" }, data: { type: "string", description: "aaaa-mm-dd" }, tipo: { type: "integer" } }, required: ["codigo", "descricao", "data"] },
    async executar(ctx, e) {
      await garantirCotacaoDoConsultor(ctx.usuario, e.codigo);
      return prepararAcao(ctx, "powercrm", "POST", "/api/quotation/add-activity", { corpo: { quotationCode: e.codigo, description: e.descricao, scheduled: e.data, type: e.tipo ?? 2 } },
        `Agendar na cotação ${e.codigo}, para ${dataBR(e.data)}: "${e.descricao}".`);
    },
  },

  // ===== ações SGA de rotina =====
  {
    nome: "sga_registrar_atendimento",
    descricao: "Prepara registrar um atendimento no histórico do associado no SGA (o que foi tratado, com quem, resultado). Use tabelas_atendimento para achar os códigos de departamento, tipo e status.",
    papel: "consultor",
    esquema: {
      type: "object",
      properties: {
        cpf: { type: "string" }, codigo_associado: { type: "integer" }, placa: { type: "string" }, titulo: { type: "string" }, descricao: { type: "string" },
        codigo_departamento: { type: "integer" }, codigo_tipo_atendimento: { type: "integer" }, codigo_status_atendimento: { type: "integer" },
      },
      required: ["codigo_associado", "titulo", "descricao", "codigo_departamento", "codigo_tipo_atendimento", "codigo_status_atendimento"],
    },
    async executar(ctx, e) {
      await garantirAssociadoDoConsultor(ctx.usuario, String(e.cpf || e.codigo_associado));
      const corpo = { ...e, descricao: `${e.descricao}\n\n(Registrado pela Paloma a pedido de ${ctx.usuario.nome})` };
      return prepararAcao(ctx, "sga", "POST", "/cadastrar/historico-atendimento-associado", corpo,
        `Registrar no histórico do associado ${e.codigo_associado}${e.placa ? ` (placa ${e.placa})` : ""} o atendimento "${e.titulo}".`);
    },
  },
  {
    nome: "tabelas_atendimento",
    descricao: "Lista departamentos, tipos e status de atendimento do SGA (códigos para registrar atendimento).",
    papel: "consultor",
    esquema: { type: "object", properties: {} },
    async executar() {
      const [dep, tipo, st] = await Promise.all([
        sga("GET", "listar/departamento/ativo"), sga("GET", "listar/tipo-atendimento/ativo"), sga("GET", "listar/status-atendimento/ativo"),
      ]);
      return json({ departamentos: dep, tipos: tipo, status: st });
    },
  },
  {
    nome: "boleto_alterar_vencimento",
    descricao: "Prepara alterar o vencimento de um boleto no SGA (pelo nosso número).",
    papel: "cadastro",
    esquema: { type: "object", properties: { nosso_numero: { type: "string" }, nova_data: { type: "string", description: "aaaa-mm-dd" } }, required: ["nosso_numero", "nova_data"] },
    async executar(ctx, e) {
      return prepararAcao(ctx, "sga", "POST", "alterar/vencimento-boleto", { nosso_numero: Number(digitos(e.nosso_numero)), nova_data_vencimento: dataBR(e.nova_data) },
        `Alterar o vencimento do boleto ${e.nosso_numero} para ${dataBR(e.nova_data)}.`);
    },
  },
  {
    nome: "sga_foto_veiculo",
    descricao: "Prepara enviar para o SGA, no cadastro do veículo, fotos recebidas pelo WhatsApp. codigo_tipo vem de listar/tipo-foto/ativo.",
    papel: "cadastro",
    esquema: {
      type: "object",
      properties: { codigo_veiculo: { type: "integer" }, codigo_tipo: { type: "integer" }, arquivo_ids: { type: "array", items: { type: "string" } }, codigo_evento: { type: "integer" } },
      required: ["codigo_veiculo", "codigo_tipo", "arquivo_ids"],
    },
    async executar(ctx, e) {
      const arqs = await q(`select id, nome, mime, encode(conteudo,'base64') b64 from paloma.arquivos where id = any($1::uuid[])`, [e.arquivo_ids]);
      if (!arqs.length) return "Não achei esses arquivos.";
      const foto = arqs.map((a: any, i: number) => ({ nome_arquivo: a.nome || `foto_${i + 1}.jpg`, codigo_tipo: e.codigo_tipo, binario: a.b64 }));
      const corpo: any = { codigo_veiculo: e.codigo_veiculo, foto };
      if (e.codigo_evento) corpo.codigo_evento = e.codigo_evento;
      return prepararAcao(ctx, "sga", "POST", "/veiculo/foto/cadastrar", corpo,
        `Enviar ${arqs.length} foto(s) para o veículo ${e.codigo_veiculo} no SGA${e.codigo_evento ? `, vinculadas ao evento ${e.codigo_evento}` : ""}.`);
    },
  },

  // ===== acesso amplo =====
  {
    nome: "api_catalogo",
    descricao: "Procura no catálogo completo das APIs (SGA: 136 rotas; Power CRM: 25) a rota certa para o que você precisa, com os campos. Use antes de api_sga/api_powercrm.",
    papel: "cadastro",
    esquema: { type: "object", properties: { sistema: { type: "string", enum: ["sga", "powercrm"] }, busca: { type: "string" } }, required: ["sistema", "busca"] },
    async executar(_ctx, e) {
      const termos = String(e.busca).toLowerCase().split(/\s+/).filter(Boolean);
      if (e.sistema === "powercrm") return json(rotasPowerCrm.filter((r) => termos.some((t) => (r.rota + " " + r.descricao).toLowerCase().includes(t))));
      return json(rotasSga.filter((r) => termos.some((t) => `${r.grupo} ${r.rota} ${r.titulo}`.toLowerCase().includes(t))).slice(0, 25));
    },
  },
  {
    nome: "api_sga",
    descricao: "Chama qualquer rota da API do SGA (ver api_catalogo). Rotas de consulta executam na hora; rotas que gravam (cadastrar, alterar, excluir, vincular, remover) viram ação pendente. Datas em dd/mm/aaaa.",
    papel: "cadastro",
    esquema: {
      type: "object",
      properties: { metodo: { type: "string", enum: ["GET", "POST"] }, rota: { type: "string", description: "caminho com os parâmetros já preenchidos, ex.: veiculo/buscar/ABC1D23" }, corpo: { type: "object", additionalProperties: true }, resumo: { type: "string", description: "para rotas que gravam: o que a ação faz, em português" } },
      required: ["metodo", "rota"],
    },
    async executar(ctx, e) {
      const r = rotaDoCatalogo(e.metodo, e.rota);
      if (!r) return `A rota ${e.metodo} ${e.rota} não existe no catálogo do SGA. Use api_catalogo.`;
      if (rotaSgaRestritaDiretoria(e.rota) && !pode(ctx.usuario, "diretoria")) throw new SemPermissao("Financeiro (MGF) é só com a diretoria.");
      if (rotaSgaGrava(e.rota)) return prepararAcao(ctx, "sga", e.metodo, e.rota, e.corpo, e.resumo || `${r.titulo} (${r.grupo}) no SGA: ${JSON.stringify(e.corpo ?? {}).slice(0, 300)}`);
      return json(await sga(e.metodo, e.rota, e.corpo));
    },
  },
  {
    nome: "api_powercrm",
    descricao: "Chama qualquer rota da Power API (ver api_catalogo). Consultas executam na hora; rotas que gravam viram ação pendente. Use {chave} no caminho só já preenchido.",
    papel: "cadastro",
    esquema: {
      type: "object",
      properties: { metodo: { type: "string", enum: ["GET", "POST", "PUT"] }, rota: { type: "string" }, query: { type: "object", additionalProperties: true }, corpo: { type: "object", additionalProperties: true }, resumo: { type: "string" } },
      required: ["metodo", "rota"],
    },
    async executar(ctx, e) {
      const base = rotasPowerCrm.find((r) => r.metodo === e.metodo && new RegExp("^" + r.rota.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(e.rota));
      if (!base) return `A rota ${e.metodo} ${e.rota} não está no catálogo da Power API. Use api_catalogo.`;
      if (base.rota === "/api/report/db" && !pode(ctx.usuario, "gerencia")) throw new SemPermissao("O relatório da base é com a gerência.");
      if (base.grava) return prepararAcao(ctx, "powercrm", e.metodo, e.rota, { query: e.query, corpo: e.corpo }, e.resumo || `${base.descricao}: ${JSON.stringify({ query: e.query, corpo: e.corpo }).slice(0, 300)}`);
      return json(await powercrm(e.metodo, e.rota, { query: e.query, corpo: e.corpo }));
    },
  },
  {
    nome: "consulta_base",
    descricao: `Consulta SQL somente leitura na base espelhada (para números, rankings, inadimplência, produção por consultor/regional). Tabelas: public.jrpv_veiculos (placa, codigo_associado, nome_associado, cpf_associado, descricao_situacao, marca, modelo, valor_fipe, codigo_regional, codigo_cooperativa, codigo_voluntario, data_contrato, data_cadastro), public.jrpv_associados (codigo_associado, nome, cpf, descricao_situacao, codigo_regional, data_contrato), public.jrpv_boletos (nosso_numero, codigo_associado, descricao_situacao_boleto, mes_referente, data_vencimento, valor_boleto, data_pagamento, valor_pagamento, codigo_regional), public.jrpv_eventos (codigo_evento, protocolo, codigo_veiculo, codigo_associado, valor_reparo, participacao, motivo, situacao_evento, data_evento, cidade, codigo_regional), public.jrpv_voluntarios (codigo_voluntario, nome, cpf, cidade, situacao), public.jrpv_regionais, public.jrpv_cooperativas, public.jrpv_kpis (dados jsonb), public.jrpv_kpis_regional, paloma.pcrm_cotacoes (quotation_code, cliente_nome, placa, consultor_nome, consultor_email, cooperativa, card_status 1..5, arquivada, criado_no_crm, dados jsonb do relatório do Power). Máximo 200 linhas.`,
    papel: "gerencia",
    esquema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] },
    async executar(_ctx, e) {
      const sql = String(e.sql).trim().replace(/;+\s*$/, "");
      if (!/^(select|with)\b/i.test(sql) || /;/.test(sql)) return "Só aceito uma consulta SELECT.";
      const c = await pool.connect();
      try {
        await c.query("begin transaction read only");
        await c.query("set local statement_timeout = '15s'");
        const r = await c.query(`select * from (${sql}) _sub limit 200`);
        await c.query("commit");
        return json({ linhas: r.rowCount, dados: r.rows }, 15000);
      } catch (x) {
        await c.query("rollback").catch(() => {});
        return `Erro na consulta: ${(x as Error).message}`;
      } finally {
        c.release();
      }
    },
  },
  {
    nome: "indicadores",
    descricao: "Indicadores consolidados da operação (frota, inadimplência, eventos, financeiro) e por regional, calculados pelo JRPV-DATA.BI.",
    papel: "gerencia",
    esquema: { type: "object", properties: { codigo_regional: { type: "integer" } } },
    async executar(_ctx, e) {
      if (e.codigo_regional) return json(await um(`select * from public.jrpv_kpis_regional where codigo_regional=$1`, [e.codigo_regional]));
      return json({ geral: await um(`select dados, calculado_em from public.jrpv_kpis order by calculado_em desc limit 1`), regionais: await q(`select codigo_regional, nome_regional, calculado_em from public.jrpv_kpis_regional`) }, 20000);
    },
  },

  // ===== confirmação =====
  {
    nome: "confirmar_acao",
    descricao: "Executa uma ação pendente DEPOIS que a pessoa confirmou numa mensagem nova. Nunca chame no mesmo turno em que a ação foi preparada.",
    papel: "consultor",
    esquema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    async executar(ctx, e) {
      const a = await um(`select * from paloma.acoes where id=$1 and usuario_id=$2`, [e.id, ctx.usuario.id]);
      if (!a) return "Não achei essa ação.";
      if (a.status !== "pendente") return `Essa ação está como "${a.status}", não dá para executar.`;
      if (new Date(a.criado_em) >= ctx.inicioTurno) return "Essa ação acabou de ser preparada. Mostre o resumo e espere a pessoa confirmar.";
      if (Date.now() - new Date(a.criado_em).getTime() > 30 * 60e3) {
        await q(`update paloma.acoes set status='expirada' where id=$1`, [a.id]);
        return "Essa ação expirou (mais de 30 min). Prepare de novo se ainda fizer sentido.";
      }
      try {
        const r = await executarAcao(a);
        await q(`update paloma.acoes set status='executada', resultado=$2, executado_em=now() where id=$1`, [a.id, JSON.stringify(r ?? {})]);
        return json({ ok: true, acao: a.resumo, resposta_do_sistema: r });
      } catch (x) {
        await q(`update paloma.acoes set status='erro', resultado=$2, executado_em=now() where id=$1`, [a.id, JSON.stringify({ erro: (x as Error).message })]);
        return `Deu erro ao executar: ${(x as Error).message}`;
      }
    },
  },
  {
    nome: "cancelar_acao",
    descricao: "Cancela uma ação pendente (a pessoa desistiu ou quer mudar algo).",
    papel: "consultor",
    esquema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    async executar(ctx, e) {
      const r = await q(`update paloma.acoes set status='cancelada' where id=$1 and usuario_id=$2 and status='pendente' returning id`, [e.id, ctx.usuario.id]);
      return r.length ? "Cancelada." : "Não havia ação pendente com esse id.";
    },
  },

  // ===== memória =====
  {
    nome: "lembrar",
    descricao: "Guarda algo para lembrar depois. escopo 'pessoa' = só sobre quem está falando (preferências, casos em andamento). escopo 'jrpv' = regra/procedimento da casa, vale para todos (só gerência/diretoria ensinam regra da casa; de outros, guarde como 'pessoa').",
    papel: "consultor",
    esquema: { type: "object", properties: { escopo: { type: "string", enum: ["pessoa", "jrpv"] }, tipo: { type: "string", enum: ["regra", "procedimento", "fato", "preferencia", "caso"] }, texto: { type: "string" } }, required: ["escopo", "tipo", "texto"] },
    async executar(ctx, e) {
      const escopo = e.escopo === "jrpv" && !pode(ctx.usuario, "gerencia") ? "pessoa" : e.escopo;
      const r = await memoria.lembrar(ctx.usuario, escopo, e.tipo, e.texto);
      return `Memória ${r.atualizada ? "atualizada" : "guardada"} (#${r.id}, ${escopo}).`;
    },
  },
  {
    nome: "buscar_memoria",
    descricao: "Procura nas memórias (regras e procedimentos da JRPV e o que você sabe de quem está falando).",
    papel: "consultor",
    esquema: { type: "object", properties: { busca: { type: "string" } }, required: ["busca"] },
    async executar(ctx, e) {
      const r = await memoria.buscar(ctx.usuario, e.busca);
      return r.length ? json(r) : "Nada guardado sobre isso.";
    },
  },
  {
    nome: "esquecer",
    descricao: "Apaga uma memória pelo número (#id).",
    papel: "consultor",
    esquema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] },
    async executar(ctx, e) {
      return (await memoria.esquecer(ctx.usuario, e.id, pode(ctx.usuario, "gerencia"))) ? "Esquecido." : "Não achei essa memória (ou ela não é sua).";
    },
  },

  // ===== arquivos =====
  {
    nome: "ver_arquivo",
    descricao: "Abre de novo um arquivo recebido antes (foto ou PDF) pelo arquivo_id, para você olhar.",
    papel: "consultor",
    esquema: { type: "object", properties: { arquivo_id: { type: "string" } }, required: ["arquivo_id"] },
    async executar(ctx, e) {
      const a = await um(`select mime, nome, encode(conteudo,'base64') b64 from paloma.arquivos where id=$1 and (usuario_id=$2 or $3)`, [e.arquivo_id, ctx.usuario.id, pode(ctx.usuario, "cadastro")]);
      if (!a) return "Não achei esse arquivo.";
      if (a.mime === "application/pdf") return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.b64 } } as any, { type: "text", text: a.nome || "PDF" }];
      if (/^image\/(jpeg|png|gif|webp)$/.test(a.mime)) return [{ type: "image", source: { type: "base64", media_type: a.mime, data: a.b64 } }, { type: "text", text: a.nome || "imagem" }];
      return `Arquivo ${a.nome || ""} (${a.mime}) não é imagem nem PDF.`;
    },
  },

  // ===== equipe =====
  {
    nome: "avisar_pessoa",
    descricao: "Manda uma mensagem pelo WhatsApp da Paloma para alguém da equipe cadastrado (por nome). Use para repassar recado, cobrar pendência ou avisar o cadastro.",
    papel: "consultor",
    esquema: { type: "object", properties: { nome: { type: "string" }, mensagem: { type: "string" } }, required: ["nome", "mensagem"] },
    async executar(ctx, e) {
      const alvos = await q(`select id, nome, telefone from paloma.usuarios where ativo and (nome ilike '%'||$1||'%' or apelido ilike '%'||$1||'%')`, [e.nome]);
      if (alvos.length !== 1) return alvos.length ? `Achei mais de uma pessoa: ${alvos.map((a: any) => a.nome).join(", ")}. Qual delas?` : "Não achei essa pessoa entre quem fala com a Paloma.";
      const texto = `${e.mensagem}\n\n_(recado de ${ctx.usuario.apelido || ctx.usuario.nome}, via Paloma)_`;
      const wa = await enviarTexto(alvos[0].telefone, texto);
      await q(`insert into paloma.mensagens (telefone, usuario_id, papel, texto, wa_id) values ($1,$2,'aviso',$3,$4)`, [alvos[0].telefone, alvos[0].id, texto, wa]);
      return `Recado enviado para ${alvos[0].nome}.`;
    },
  },
  {
    nome: "equipe_gerenciar",
    descricao: "Cadastra, altera ou desativa quem pode falar com a Paloma. Papéis: consultor, cadastro, gerencia, diretoria, admin. Para consultor, informe codigo_voluntario (SGA) e powercrm_email.",
    papel: "gerencia",
    esquema: {
      type: "object",
      properties: {
        operacao: { type: "string", enum: ["listar", "salvar", "desativar"] }, telefone: { type: "string" }, nome: { type: "string" }, apelido: { type: "string" },
        papel: { type: "string", enum: ["consultor", "cadastro", "gerencia", "diretoria", "admin"] }, codigo_voluntario: { type: "integer" }, powercrm_email: { type: "string" }, codigo_regional: { type: "integer" },
      },
      required: ["operacao"],
    },
    async executar(ctx, e) {
      if (e.operacao === "listar") return json(await q(`select nome, apelido, telefone, papel, codigo_voluntario, powercrm_email, ativo from paloma.usuarios order by papel, nome`));
      const tel = digitos(e.telefone);
      if (tel.length < 12) return "Preciso do telefone completo com DDD (ex.: 82 99999-9999).";
      const telefone = tel.startsWith("55") ? tel : "55" + tel;
      const NIV = ["consultor", "cadastro", "gerencia", "diretoria", "admin"];
      if (e.papel && NIV.indexOf(e.papel) > NIV.indexOf(ctx.usuario.papel)) throw new SemPermissao("Você não pode dar um acesso maior que o seu.");
      if (e.operacao === "desativar") {
        const r = await q(`update paloma.usuarios set ativo=false where telefone=$1 returning nome`, [telefone]);
        return r.length ? `${r[0].nome} desativado(a).` : "Não achei esse telefone.";
      }
      if (!e.nome || !e.papel) return "Para cadastrar preciso de nome e papel.";
      await q(
        `insert into paloma.usuarios (nome, apelido, telefone, papel, codigo_voluntario, powercrm_email, codigo_regional) values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (telefone) do update set nome=excluded.nome, apelido=coalesce(excluded.apelido, paloma.usuarios.apelido), papel=excluded.papel,
           codigo_voluntario=coalesce(excluded.codigo_voluntario, paloma.usuarios.codigo_voluntario), powercrm_email=coalesce(excluded.powercrm_email, paloma.usuarios.powercrm_email),
           codigo_regional=coalesce(excluded.codigo_regional, paloma.usuarios.codigo_regional), ativo=true`,
        [e.nome, e.apelido || null, telefone, e.papel, e.codigo_voluntario ?? null, e.powercrm_email || null, e.codigo_regional ?? null]);
      return `${e.nome} salvo(a) como ${e.papel}.`;
    },
  },
  {
    nome: "voz_preferencia",
    descricao: "Liga ou desliga as respostas em áudio para quem está falando. 'auto' = responde em áudio quando a pessoa manda áudio.",
    papel: "consultor",
    esquema: { type: "object", properties: { modo: { type: "string", enum: ["auto", "sempre", "nunca"] } }, required: ["modo"] },
    async executar(ctx, e) {
      await q(`update paloma.usuarios set preferencias = preferencias || jsonb_build_object('voz', $2::text) where id=$1`, [ctx.usuario.id, e.modo]);
      return `Preferência de voz: ${e.modo}.`;
    },
  },
];

export function ferramentasPara(u: Usuario): Anthropic.Tool[] {
  return F.filter((f) => pode(u, f.papel)).map((f) => ({ name: f.nome, description: f.descricao, input_schema: f.esquema }));
}

export async function executar(ctx: Contexto, nome: string, entrada: any): Promise<{ conteudo: Resultado; erro: boolean }> {
  const f = F.find((x) => x.nome === nome);
  if (!f) return { conteudo: `Ferramenta ${nome} não existe.`, erro: true };
  if (!pode(ctx.usuario, f.papel)) return { conteudo: `Sem permissão: ${nome} exige papel ${f.papel}.`, erro: true };
  try {
    return { conteudo: await f.executar(ctx, entrada ?? {}), erro: false };
  } catch (x) {
    const e = x as Error;
    if (e instanceof SemPermissao) return { conteudo: `SEM PERMISSÃO: ${e.message}`, erro: true };
    console.error(`ferramenta ${nome}`, e);
    return { conteudo: `Erro: ${e.message}`, erro: true };
  }
}
