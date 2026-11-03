import { test } from "node:test";
import assert from "node:assert/strict";
import "./ambiente.js";
const { lerMedida, buscar, legenda } = await import("../pneus/catalogo.js");

test("medida em qualquer formato que o cliente manda", () => {
  for (const t of ["205/40 R17", "205/40R17", "205 40 17", "2054017", "205/40/17", "pneu 205-40 aro 17", "205/40ZR17"])
    assert.equal(lerMedida(t)?.texto, "205/40R17", t);
  assert.equal(lerMedida("LT265/65R17 10PR")?.texto, "265/65R17");
  assert.equal(lerMedida("215/75R17.5 135/133J")?.texto, "215/75R17.5");
  assert.equal(lerMedida("205R14C 8PR")?.texto, "205R14");
  assert.equal(lerMedida("7.50-16 TRACAO")?.texto, "7.50-16");
  assert.equal(lerMedida("31X10.5R15 AT 109S")?.texto, "31X10.5R15");
  assert.equal(lerMedida("31x10.50R15LT")?.texto, "31X10.5R15");
  assert.equal(lerMedida("35X12.50R20LT")?.texto, "35X12.5R20");
  assert.equal(lerMedida("bom dia, qual o valor?"), null);
  assert.equal(lerMedida("me liga 62 99999-1234"), null);
});

const pneu = (titulo: string, preco: number, fotos = 1) => ({
  alias: titulo, sku: titulo, titulo, marca: titulo.split(" ")[3], preco, estoque: 4,
  fotos: fotos ? ["https://x/1.jpg"] : [], medida: lerMedida(titulo.replace(/^P?NEU ARO \S+ /, "")),
});

test("busca exata, com foto e mais barato primeiro; senão a medida mais próxima do mesmo aro", () => {
  const itens = [
    pneu("PNEU ARO 17 FORCELAND 205/40R17 84W XL VITALITY F22", 410),
    pneu("PNEU ARO 17 COMFORSER 205/40R17 84W XL CF700", 380, 0),
    pneu("PNEU ARO 17 XBRI 215/45R17 91W", 420),
    pneu("PNEU ARO 18 XBRI 205/40R18 86W", 500),
  ];
  const r = buscar(itens, lerMedida("205 40 17")!);
  assert.deepEqual(r.exatos.map((p) => p.preco), [410, 380]);
  const s = buscar(itens, lerMedida("205/45R17")!);
  assert.equal(s.exatos.length, 0);
  assert.ok(s.parecidos.every((p) => p.medida!.aro === 17));
  assert.equal(legenda(itens[0]).replace(/ /g, " "),"PNEU ARO 17 FORCELAND 205/40R17 84W XL VITALITY F22\nR$ 410,00");
});
