import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediana, medianaAparada, precoMercado, resumoHistorico, precoReferencia } from '../src/preco.js';

test('mediana', () => {
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([4, 1, 2, 3]), 2.5);
  assert.equal(mediana([]), null);
});

test('mediana aparada tira loja com preço absurdo', () => {
  // 5 lojas, uma com preço errado de R$ 50 e uma de R$ 9.999
  assert.equal(medianaAparada([50, 1000, 1010, 1020, 9999]), 1010);
});

test('mercado: uma observação por loja (a menor)', () => {
  const m = precoMercado([{ loja: 'Amazon', preco: 100 }, { loja: 'amazon', preco: 90 }, { loja: 'Magalu', preco: 110 }]);
  assert.equal(m.lojas, 2);
  assert.equal(m.mercado, 100); // mediana de 90 e 110
  assert.equal(m.menor.preco, 90);
});

test('mercado com uma loja só não vale', () => {
  assert.equal(precoMercado([{ loja: 'Amazon', preco: 100 }]).mercado, null);
});

test('histórico: menor preço por dia, janelas de 60 e 90', () => {
  const agora = new Date('2026-11-27T12:00:00Z');
  const hist = [];
  for (let d = 1; d <= 20; d++) hist.push({ preco: 1000 + d, em: new Date(agora - d * 864e5).toISOString() });
  hist.push({ preco: 900, em: new Date(agora - 80 * 864e5).toISOString() }); // fora dos 60, dentro dos 90
  hist.push({ preco: 500, em: new Date(agora - 2 * 864e5 + 3600e3).toISOString() }); // mesmo dia de outro: vence a menor
  const r = resumoHistorico(hist, agora);
  assert.equal(r.diasObservados60, 20);
  assert.equal(r.minimo90, 500);
  assert.equal(r.suficiente, true);
});

test('referência: o menor entre histórico e mercado (régua conservadora)', () => {
  const agora = new Date('2026-11-27T12:00:00Z');
  const hist = Array.from({ length: 15 }, (_, i) => ({ preco: 150, em: new Date(agora - (i + 1) * 864e5) }));
  // sem histórico: mercado
  assert.equal(precoReferencia({ outras: [{ loja: 'A', preco: 100 }, { loja: 'B', preco: 120 }], historico: [], agora }).base, 'mercado');
  // loja inflou o preço antes da Black (histórico 150) e as outras lojas vendem a 110: vale 110
  let r = precoReferencia({ outras: [{ loja: 'A', preco: 100 }, { loja: 'B', preco: 120 }], historico: hist, agora });
  assert.equal(r.base, 'mercado');
  assert.equal(r.referencia, 110);
  // mercado inteiro caro (210) e o produto costuma custar 150: vale 150 (régua conservadora: o menor)
  r = precoReferencia({ outras: [{ loja: 'A', preco: 200 }, { loja: 'B', preco: 220 }], historico: hist, agora });
  assert.equal(r.base, 'historico');
  assert.equal(r.referencia, 150);
  // só histórico; nada
  assert.equal(precoReferencia({ outras: [], historico: hist, agora }).referencia, 150);
  assert.equal(precoReferencia({ outras: [], historico: [], agora }).referencia, null);
});
