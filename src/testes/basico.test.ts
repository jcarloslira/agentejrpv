import { test } from "node:test";
import assert from "node:assert/strict";
import "./ambiente.js";
import { paraFala, porExtenso } from "../voz/fonetica.js";
const { rotaDoCatalogo, rotaSgaGrava, dataBR } = await import("../integracoes/sga.js");

test("números por extenso", () => {
  assert.equal(porExtenso(0), "zero");
  assert.equal(porExtenso(21), "vinte e um");
  assert.equal(porExtenso(100), "cem");
  assert.equal(porExtenso(1300), "mil e trezentos");
  assert.equal(porExtenso(125920), "cento e vinte e cinco mil novecentos e vinte");
});

test("fala: valores, placa, data, siglas e formatação", () => {
  const f = paraFala("*Placa QRT4E21*: mensalidade R$ 362,00 vence 05/11. Confere no SGA ✅");
  assert.match(f, /quê, érre, tê, quatro, é, dois, um/);
  assert.match(f, /trezentos e sessenta e dois reais/);
  assert.match(f, /cinco de novembro/);
  assert.match(f, /ésse gê á/);
  assert.doesNotMatch(f, /[*✅]/);
  assert.match(paraFala("R$ 1.300,50"), /mil e trezentos reais e cinquenta centavos/);
});

test("catálogo do SGA casa rotas concretas", () => {
  assert.equal(rotaDoCatalogo("GET", "veiculo/buscar/ABC1D23")?.titulo, "Buscar");
  assert.equal(rotaDoCatalogo("POST", "/associado/cadastrar")?.grupo, "Associado");
  assert.equal(rotaDoCatalogo("GET", "rota/que/nao/existe"), null);
  assert.ok(rotaSgaGrava("/associado/cadastrar"));
  assert.ok(!rotaSgaGrava("veiculo/buscar/ABC1D23"));
  assert.equal(dataBR("2026-10-15"), "15/10/2026");
});
