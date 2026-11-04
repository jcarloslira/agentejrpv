/**
 * Estoque da TAIPNEUS lido do catálogo público do Ômie (preço, saldo e fotos ao vivo).
 * Só pneus com saldo. A lista inteira cabe em memória (~420 itens) e é renovada a cada 15 min;
 * os links das fotos são assinados e vencem em poucos dias, por isso nunca ficam guardados.
 */
const LOJA = "4jp5zdwh";
const BASE = `https://portalapi.omie.com.br/api/portal/omie/products/${LOJA}`;
const VALIDADE_MS = 15 * 60e3;

export type Pneu = {
  alias: string;
  sku: string;
  titulo: string;
  marca: string;
  preco: number;
  estoque: number;
  fotos: string[];
  medida: Medida | null;
};

export type Medida = { largura: number; perfil: number | null; aro: number; texto: string };

let cache: { itens: Pneu[]; em: number } | null = null;
let carregando: Promise<Pneu[]> | null = null;

/**
 * Lê a medida de um texto livre: "205/40 R17", "205 40 17", "2054017", "LT265/65R17",
 * "205R14C", "7.50-16". Devolve null quando não acha.
 */
export function lerMedida(texto: string): Medida | null {
  const t = String(texto || "").toUpperCase().replace(/,/g, ".");
  // polegadas, de caminhonete: 31X10.5R15, 35x12.50R20LT, "31 10.5 15"
  let m = t.match(/(?<!\d)(2[6-9]|3[0-9])\s*[X\s]\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:R|\s|ARO)\s*(\d{2})(?!\d)/);
  if (m) {
    const perfil = Number(m[2]);
    return { largura: Number(m[1]), perfil, aro: Number(m[3]), texto: `${m[1]}X${perfil}R${m[3]}` };
  }
  m = t.match(/(?:LT)?\s*(\d{3})\s*[\/\s.-]?\s*(\d{2})\s*Z?\s*(?:R|ZR|\/|-|\s|ARO)?\s*(\d{2}(?:\.5)?)(?!\d)/);
  if (m) {
    const [largura, perfil, aro] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (largura >= 125 && largura <= 395 && perfil >= 25 && perfil <= 85 && aro >= 12 && aro <= 28)
      return { largura, perfil, aro, texto: `${largura}/${perfil}R${aro}` };
  }
  m = t.match(/(\d{3})\s*R\s*(\d{2})\s*C?\b/);
  if (m) return { largura: Number(m[1]), perfil: null, aro: Number(m[2]), texto: `${m[1]}R${m[2]}` };
  m = t.match(/(\d{1,2}\.\d{2})\s*-\s*(\d{2})/);
  if (m) return { largura: Number(m[1]), perfil: null, aro: Number(m[2]), texto: `${m[1]}-${m[2]}` };
  return null;
}

async function pagina(offset: number): Promise<{ itens: any[]; total: number }> {
  const r = await fetch(`${BASE}?offset=${offset}&limit=200&filter=stock`, {
    headers: { Origin: "https://portal.omie.com.br", "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Ômie respondeu ${r.status}`);
  const j: any = await r.json();
  return { itens: j?.data?.products ?? [], total: Number(j?.data?.total ?? 0) };
}

async function baixarTudo(): Promise<Pneu[]> {
  const brutos: any[] = [];
  for (let offset = 0; offset < 3000; offset += 200) {
    const { itens, total } = await pagina(offset);
    brutos.push(...itens);
    if (!itens.length || brutos.length >= total) break;
  }
  return brutos
    .filter((p) => Number(p?.stock?.qty) > 0 && Number(p?.price?.current) > 0)
    .map((p) => {
      const titulo = String(p.title || "").replace(/\s+/g, " ").trim();
      return {
        alias: String(p.product_alias),
        sku: String(p.sku || ""),
        titulo,
        marca: String(p.brand || ""),
        preco: Number(p.price.current),
        estoque: Number(p.stock.qty),
        fotos: (p.images ?? []).filter((i: any) => i?.type === "image" && i.url).map((i: any) => String(i.url)),
        medida: lerMedida(titulo.replace(/^P?NEU ARO \S+ /, "")),
      };
    });
}

export async function estoque(): Promise<Pneu[]> {
  if (cache && Date.now() - cache.em < VALIDADE_MS) return cache.itens;
  carregando ??= baixarTudo()
    .then((itens) => { cache = { itens, em: Date.now() }; return itens; })
    .finally(() => { carregando = null; });
  try {
    return await carregando;
  } catch (e) {
    if (cache) return cache.itens; // Ômie fora do ar: segue com a última lista boa
    throw e;
  }
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Linha que a loja manda junto da foto: descrição + valor, do jeito que os vendedores já fazem. */
export const legenda = (p: Pneu) => `${p.titulo}\n${brl(p.preco)}`;

/**
 * Busca pela medida. Sem a medida exata, sugere as mais próximas do mesmo aro
 * (largura e perfil vizinhos), que é o que o vendedor oferece no balcão.
 */
export function buscar(itens: Pneu[], medida: Medida, termo = ""): { exatos: Pneu[]; parecidos: Pneu[] } {
  const filtro = termo.trim().toUpperCase();
  const casaTermo = (p: Pneu) => !filtro || p.titulo.toUpperCase().includes(filtro) || p.marca.toUpperCase().includes(filtro);
  const comFotoPrimeiro = (a: Pneu, b: Pneu) => (b.fotos.length ? 1 : 0) - (a.fotos.length ? 1 : 0) || a.preco - b.preco;
  const exatos = itens
    .filter((p) => p.medida && p.medida.largura === medida.largura && p.medida.aro === medida.aro
      && (medida.perfil == null || p.medida.perfil === medida.perfil) && casaTermo(p))
    .sort(comFotoPrimeiro);
  if (exatos.length) return { exatos, parecidos: [] };
  const distancia = (p: Pneu) =>
    Math.abs(p.medida!.largura - medida.largura) / 10 + Math.abs((p.medida!.perfil ?? 0) - (medida.perfil ?? 0)) / 5;
  const parecidos = itens
    .filter((p) => p.medida && p.medida.aro === medida.aro && distancia(p) <= 3)
    .sort((a, b) => distancia(a) - distancia(b) || comFotoPrimeiro(a, b))
    .slice(0, 6);
  return { exatos: [], parecidos };
}

/** Busca livre por texto (marca, modelo, "aro 17"), quando a pessoa não manda a medida. */
export function buscarTexto(itens: Pneu[], texto: string): Pneu[] {
  const palavras = texto.toUpperCase().split(/\s+/).filter((w) => w.length >= 2);
  if (!palavras.length) return [];
  return itens.filter((p) => palavras.every((w) => p.titulo.toUpperCase().includes(w))).slice(0, 8);
}
