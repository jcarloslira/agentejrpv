/**
 * Prepara o texto da Paloma para virar áudio na ElevenLabs.
 * O WhatsApp aceita *negrito*, listas e emojis; a voz não. E placa, CPF, valores e
 * siglas precisam ser escritos do jeito que se fala, senão a voz soletra errado.
 */

const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const LETRAS: Record<string, string> = {
  A: "á", B: "bê", C: "cê", D: "dê", E: "é", F: "éfe", G: "gê", H: "agá", I: "í", J: "jota", K: "cá", L: "éle", M: "ême",
  N: "êne", O: "ó", P: "pê", Q: "quê", R: "érre", S: "ésse", T: "tê", U: "ú", V: "vê", W: "dáblio", X: "xis", Y: "ípsilon", Z: "zê",
};

function soletrar(s: string): string {
  return s.toUpperCase().split("").map((c) => (/\d/.test(c) ? UNIDADES[Number(c)] : LETRAS[c] ?? "")).filter(Boolean).join(", ");
}

const ATE_19 = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (r) partes.push(r < 20 ? ATE_19[r] : DEZENAS[Math.floor(r / 10)] + (r % 10 ? " e " + ATE_19[r % 10] : ""));
  return partes.join(" e ") || "zero";
}

export function porExtenso(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  n = Math.floor(Math.abs(n));
  if (n < 1000) return ate999(n);
  const grupos: Array<[number, string, string]> = [[1e9, "bilhão", "bilhões"], [1e6, "milhão", "milhões"], [1e3, "mil", "mil"]];
  const partes: string[] = [];
  let resto = n;
  for (const [v, sing, plur] of grupos) {
    const q = Math.floor(resto / v);
    if (q) {
      partes.push(v === 1e3 && q === 1 ? "mil" : `${porExtenso(q)} ${q === 1 ? sing : plur}`);
      resto %= v;
    }
  }
  if (resto) partes.push((resto < 100 || resto % 100 === 0 ? "e " : "") + ate999(resto));
  return partes.join(" ").replace(/\s+/g, " ");
}

function dinheiro(valor: string): string {
  const limpo = valor.replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  if (!Number.isFinite(n)) return valor;
  const reais = Math.floor(n), cent = Math.round((n - reais) * 100);
  let s = reais ? `${porExtenso(reais)} ${reais === 1 ? "real" : "reais"}` : "";
  if (cent) s += `${s ? " e " : ""}${porExtenso(cent)} ${cent === 1 ? "centavo" : "centavos"}`;
  return s || "zero reais";
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const SIGLAS: Record<string, string> = {
  SGA: "ésse gê á", CRM: "cê érre ême", CPF: "cê pê éfe", CNPJ: "cê ene pê jota", CNH: "cê ene agá", CRLV: "cê érre éle vê",
  FIPE: "fípi", JRPV: "jota érre pê vê", "B.O.": "bê ó", BO: "bê ó", PIX: "pix", OK: "ok", WhatsApp: "uótsápi", PDF: "pê dê éfe",
  RG: "érre gê", KM: "quilômetros", km: "quilômetros", MGF: "ême gê éfe", "Power CRM": "páuer cê érre ême",
};

export function paraFala(texto: string): string {
  let t = texto;
  // formatação do WhatsApp e emojis
  t = t.replace(/[*_~`]/g, "").replace(/\p{Extended_Pictographic}️?/gu, "").replace(/^\s*[-•]\s+/gm, "");
  // links não se leem
  t = t.replace(/https?:\/\/\S+/g, "o link que te mandei");
  // R$ 1.234,56
  t = t.replace(/R\$\s?([\d.]+(?:,\d{1,2})?)/g, (_, v) => dinheiro(v));
  // placas: ABC-1234 / ABC1D23
  t = t.replace(/\b([A-Z]{3})-?(\d[A-Z0-9]\d{2})\b/g, (_, l, n) => soletrar(l + n));
  // CPF / telefone / códigos longos: dígito a dígito, em grupos
  t = t.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, (m) => m.split(/[.-]/).map(soletrar).join("... "));
  t = t.replace(/\(?\b(\d{2})\)?\s?(9?\d{4})-?(\d{4})\b/g, (_, a, b, c) => [a, b, c].map(soletrar).join("... "));
  // datas dd/mm/aaaa e dd/mm
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, (m, d, mm, a) => {
    const mes = MESES[Number(mm) - 1];
    if (!mes || Number(d) > 31) return m;
    const dia = Number(d) === 1 ? "primeiro" : porExtenso(Number(d));
    return `${dia} de ${mes}${a ? ` de ${porExtenso(Number(a.length === 2 ? "20" + a : a))}` : ""}`;
  });
  // horas 14h30 / 14:30
  t = t.replace(/\b(\d{1,2})[h:](\d{2})\b/g, (_, h, m) => `${porExtenso(Number(h))} e ${porExtenso(Number(m))}`);
  // porcentagem
  t = t.replace(/(\d+(?:,\d+)?)\s?%/g, (_, v) => `${v.replace(",", " vírgula ")} por cento`);
  // siglas
  for (const [s, f] of Object.entries(SIGLAS)) t = t.replace(new RegExp(`(?<![\\wÀ-ú])${s.replace(/\./g, "\\.")}(?![\\wÀ-ú])`, "g"), f);
  // números soltos grandes com ponto de milhar
  t = t.replace(/\b\d{1,3}(?:\.\d{3})+\b/g, (m) => porExtenso(Number(m.replace(/\./g, ""))));
  return t.replace(/\n{2,}/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}
