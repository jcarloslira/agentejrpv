/**
 * Cliente da Power API (Power CRM). Autenticação: Bearer <token da Power API>.
 * Referência completa em docs/api/powercrm-openapi.json.
 */
import { config } from "../config.js";

const BASE = "https://api.powercrm.com.br";

export class ErroPowerCrm extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ErroPowerCrm";
  }
}

type Opcoes = { query?: Record<string, string | number | undefined>; corpo?: unknown; binario?: { dados: Buffer; mime: string } };

export async function powercrm(metodo: "GET" | "POST" | "PUT", rota: string, op: Opcoes = {}, tentativa = 0): Promise<any> {
  const url = new URL(BASE + "/" + rota.replace(/^\/+/, ""));
  for (const [k, v] of Object.entries(op.query ?? {})) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { Authorization: `Bearer ${config.powercrmToken}`, Accept: "application/json" };
  let body: BodyInit | undefined;
  if (op.binario) {
    headers["Content-Type"] = op.binario.mime || "application/octet-stream";
    body = new Uint8Array(op.binario.dados);
  } else if (op.corpo !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(op.corpo);
  }
  const r = await fetch(url, { method: metodo, headers, body });
  const texto = await r.text();
  // o Power devolve 500/502/504/520 com frequência; consultas tentam de novo (gravações não, para não duplicar)
  if (!r.ok && r.status >= 500 && metodo === "GET" || (!r.ok && r.status >= 500 && rota.includes("/api/report/db"))) {
    if (tentativa < 2) {
      await new Promise((ok) => setTimeout(ok, 3000 * (tentativa + 1)));
      return powercrm(metodo, rota, op, tentativa + 1);
    }
  }
  if (!r.ok) {
    let msg = texto.slice(0, 600);
    try {
      const j = JSON.parse(texto);
      msg = (j.errors || j.errorVO?.errors || [j.message || j.error]).filter(Boolean).join(" — ") || msg;
    } catch { /* texto cru */ }
    throw new ErroPowerCrm(`Power CRM respondeu ${r.status} em ${url.pathname}: ${msg}`, r.status);
  }
  if (!texto.trim()) return {};
  try {
    return JSON.parse(texto);
  } catch {
    return { texto: texto.slice(0, 4000) };
  }
}

/** Colunas do funil aceitas por /api/quotation/card/move */
export const COLUNAS_FUNIL = ["RECEIVED", "IN_NEGOTIATION", "INSPECTION", "RELEASED_FOR_REGISTRATION", "COMPLETED"] as const;

/** Status numérico do relatório (cardStatus) → nome no funil */
export const STATUS_CARD: Record<string, string> = {
  "1": "Recebida",
  "2": "Em negociação",
  "3": "Vistoria",
  "4": "Liberada para cadastro",
  "5": "Concluída",
};

/** Rotas da Power API, para a ferramenta genérica e para saber o que grava. */
export const rotasPowerCrm: Array<{ metodo: "GET" | "POST" | "PUT"; rota: string; grava: boolean; descricao: string }> = [
  { metodo: "GET", rota: "/api/quotation/{quotationCode}", grava: false, descricao: "Consulta cotação" },
  { metodo: "GET", rota: "/api/quotation/plansQuotation", grava: false, descricao: "Planos e valores da cotação (query quotationCode)" },
  { metodo: "GET", rota: "/api/quotation/quotationFipeApi", grava: false, descricao: "FIPE da cotação (query quotationCode)" },
  { metodo: "GET", rota: "/api/negotiation/{negotiationCode}", grava: false, descricao: "Consulta negociação" },
  { metodo: "GET", rota: "/api/quotation/cb", grava: false, descricao: "Marcas (query type: 1 carro, 2 moto, 3 caminhão)" },
  { metodo: "GET", rota: "/api/quotation/bmy", grava: false, descricao: "Anos-modelo da marca (query cb)" },
  { metodo: "GET", rota: "/api/quotation/cmby", grava: false, descricao: "Modelos por marca e ano (query cb, cy)" },
  { metodo: "GET", rota: "/api/quotation/stt", grava: false, descricao: "Estados" },
  { metodo: "GET", rota: "/api/quotation/ct", grava: false, descricao: "Cidades do estado (query st)" },
  { metodo: "POST", rota: "/api/consultant/powerlink", grava: false, descricao: "PowerLink do consultor (corpo email ou phone)" },
  { metodo: "POST", rota: "/api/quotation/fetchAffiliate", grava: false, descricao: "Extrato de afiliado (corpo begin, end, email, filterStatus)" },
  { metodo: "POST", rota: "/api/report/db", grava: false, descricao: "Relatório da base (corpo from, to aaaa-mm-dd, stringFilterTypeDate 1=criação 2=atualização)" },
  { metodo: "POST", rota: "/api/quotation/add", grava: true, descricao: "Cria cotação (name obrigatório; phone, email, plts, chassi, registration, city, coop, mdl, mdlYr, slsmnId, pwrlnk, leadSource, origemId, workVehicle)" },
  { metodo: "POST", rota: "/api/quotation/update", grava: true, descricao: "Altera cotação (code obrigatório; dados pessoais, endereço, veículo, plano tppId, protectedValue, expirationDay, noteContract)" },
  { metodo: "POST", rota: "/api/quotation/card/move", grava: true, descricao: "Move card (query quotationCode, cardColumn RECEIVED|IN_NEGOTIATION|INSPECTION|RELEASED_FOR_REGISTRATION|COMPLETED)" },
  { metodo: "POST", rota: "/api/quotation/add-tag", grava: true, descricao: "Etiqueta (corpo quotationCode, tagId)" },
  { metodo: "POST", rota: "/api/quotation/send-observation", grava: true, descricao: "Observação (query quotationCode, observation)" },
  { metodo: "POST", rota: "/api/quotation/send-attachment", grava: true, descricao: "Anexo binário (query quotationCode)" },
  { metodo: "POST", rota: "/api/quotation/open-inspection", grava: true, descricao: "Abre vistoria (corpo quotationCode, observation)" },
  { metodo: "POST", rota: "/api/quotation/send-photo", grava: true, descricao: "Foto da vistoria, binário (query inspectionId)" },
  { metodo: "POST", rota: "/api/quotation/add-activity", grava: true, descricao: "Agenda atividade (corpo quotationCode, description, scheduled aaaa-mm-dd, type 2=telefone)" },
  { metodo: "POST", rota: "/api/quotation/quotationConfirmCashReceivedApi", grava: true, descricao: "Confirma pagamento da adesão (query cardId)" },
  { metodo: "POST", rota: "/api/quotation/quotationTrackerConfirmCashReceivedApi", grava: true, descricao: "Confirma pagamento do rastreador (query cardId)" },
  { metodo: "POST", rota: "/api/quotation/addAffiliate", grava: true, descricao: "Cadastra afiliado (cpf, email, name, phone, status)" },
  { metodo: "POST", rota: "/api/quotation/addAffiliateSGA", grava: true, descricao: "Cadastra afiliado SGA" },
];
