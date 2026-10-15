/**
 * Cliente da API Hinova SGA v2.
 *
 * Comportamentos confirmados contra a API real (vindos do JRPV-DATA.BI):
 *  - Datas em dd/mm/yyyy; ISO costuma dar 406.
 *  - 406 serve tanto para erro de parâmetro quanto para "nenhum registro encontrado".
 *  - Listagens vêm embrulhadas ({veiculos:[]}, {boletos:[]}, ...).
 *  - O token de usuário expira; renovamos sozinhos ao receber 401.
 */
import { config } from "../config.js";
import catalogo from "./catalogo-sga.json" with { type: "json" };

const BASE = "https://api.hinova.com.br/api/sga/v2";

export class ErroSga extends Error {
  constructor(message: string, readonly status?: number, readonly corpo?: string) {
    super(message);
    this.name = "ErroSga";
  }
}

let tokenUsuario: { valor: string; em: number } | null = null;
let autenticando: Promise<string> | null = null;

async function autenticar(): Promise<string> {
  const r = await fetch(`${BASE}/usuario/autenticar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.hinova.tokenApi}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ usuario: config.hinova.usuario, senha: config.hinova.senha }),
  });
  const texto = await r.text();
  if (!r.ok) throw new ErroSga(`Falha ao autenticar no SGA (HTTP ${r.status})`, r.status, texto.slice(0, 400));
  const j = JSON.parse(texto);
  const t = j.token_usuario ?? j.token;
  if (!t) throw new ErroSga("O SGA autenticou mas não devolveu token_usuario.");
  tokenUsuario = { valor: t, em: Date.now() };
  return t;
}

async function token(forcar = false): Promise<string> {
  // um token por ~50 min; uma autenticação por vez (o SGA invalida tokens antigos)
  if (!forcar && tokenUsuario && Date.now() - tokenUsuario.em < 50 * 60e3) return tokenUsuario.valor;
  if (!autenticando) autenticando = autenticar().finally(() => (autenticando = null));
  return autenticando;
}

function periodoVazio(corpo: string): boolean {
  try {
    const j = JSON.parse(corpo);
    const msgs = [j.mensagem, j.message, ...[].concat(j.error ?? []), ...[].concat(j.erro ?? [])].filter(Boolean).join(" | ");
    return /n[ãa]o (foram|foi) encontrad|nenhum registro|sem registros/i.test(msgs);
  } catch {
    return false;
  }
}

export async function sga(metodo: "GET" | "POST", rota: string, corpo?: unknown, tentativa = 0): Promise<any> {
  const caminho = "/" + rota.replace(/^\/+/, "");
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${await token(tentativa > 0)}`, "Content-Type": "application/json", Accept: "application/json" },
    body: metodo === "POST" ? JSON.stringify(corpo ?? {}) : undefined,
  });
  const texto = await r.text();
  if (r.status === 401 && tentativa === 0) return sga(metodo, rota, corpo, 1);
  if (!r.ok) {
    if (r.status === 406 && periodoVazio(texto)) return [];
    let msg = texto.slice(0, 600);
    try {
      const j = JSON.parse(texto);
      msg = [j.mensagem, ...[].concat(j.error ?? []), ...[].concat(j.erro ?? [])].filter(Boolean).join(" — ") || msg;
    } catch { /* texto cru */ }
    throw new ErroSga(`SGA respondeu ${r.status} em ${caminho}: ${msg}`, r.status, texto.slice(0, 600));
  }
  if (!texto.trim()) return {};
  try {
    return JSON.parse(texto);
  } catch {
    return { texto: texto.slice(0, 4000) };
  }
}

/** Data no formato que o SGA exige. Aceita Date ou "aaaa-mm-dd". */
export function dataBR(d: Date | string): string {
  if (typeof d === "string") {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  }
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getFullYear()}`;
}

export type RotaSga = { grupo: string; metodo: string; rota: string; titulo: string; campos: string[] };
export const rotasSga = catalogo as RotaSga[];

/** Rotas que gravam alguma coisa no SGA: passam por confirmação. */
export function rotaSgaGrava(rota: string): boolean {
  return /cadastrar|alterar|excluir|remover|vincular|incluir|gerar-url/i.test(rota);
}

/** Acha a rota do catálogo que casa com um caminho concreto (ex.: veiculo/buscar/ABC1D23). */
export function rotaDoCatalogo(metodo: string, caminho: string): RotaSga | null {
  const limpo = "/" + caminho.replace(/^\/+/, "").replace(/\/+$/, "");
  for (const r of rotasSga) {
    if (r.metodo !== metodo.toUpperCase()) continue;
    const padrao = "^" + r.rota.replace(/\/+$/, "").replace(/:[^/]+/g, "[^/]+") + "$";
    if (new RegExp(padrao, "i").test(limpo)) return r;
  }
  return null;
}
