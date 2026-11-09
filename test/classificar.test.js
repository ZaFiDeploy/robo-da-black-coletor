import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificar } from '../src/classificar.js';

test('limiares das classes', () => {
  assert.equal(classificar({ preco: 70, de: 70, referencia: 100 }).classe, 'imperdivel'); // 30%
  assert.equal(classificar({ preco: 85, de: 85, referencia: 100 }).classe, 'otimo');      // 15%
  assert.equal(classificar({ preco: 95, de: 95, referencia: 100 }).classe, 'bom');        // 5%
  assert.equal(classificar({ preco: 96, de: 96, referencia: 100 }).classe, 'sem_desconto');
});

test('desconto falso: loja anuncia ≥10% e o real é <5%', () => {
  const r = classificar({ preco: 2215, de: 3424, referencia: 2231.55 }); // TV LG da coleta de 07/11
  assert.equal(r.classe, 'falso');
  assert.ok(r.anunciado > 0.35);
});

test('anúncio de 9% com real 0% não é falso, é só sem desconto', () => {
  assert.equal(classificar({ preco: 100, de: 109.9, referencia: 100 }).classe, 'sem_desconto');
});

test('falso vence mesmo quando o preço está acima do mercado', () => {
  assert.equal(classificar({ preco: 284.05, de: 339, referencia: 268.89, mercado: 268.89 }).classe, 'falso');
});

test('trava: abaixo do histórico mas acima do mercado hoje vira sem desconto', () => {
  const r = classificar({ preco: 1000, de: 1000, referencia: 1500, mercado: 900 });
  assert.equal(r.classe, 'sem_desconto');
});

test('sem referência não julga', () => {
  assert.equal(classificar({ preco: 100, de: 200, referencia: null }).classe, 'sem_dados');
});

test('menor preço em 90 dias', () => {
  assert.equal(classificar({ preco: 90, de: 120, referencia: 120, minimo90: 95 }).menorEm90, true);
  assert.equal(classificar({ preco: 100, de: 120, referencia: 120, minimo90: 95 }).menorEm90, false);
});

test('economia em reais', () => {
  assert.equal(classificar({ preco: 1529.15, de: 1699, referencia: 2699 }).economia, 1169.85);
});

// --- vereditos novos (08/11): 1 loja comparada, "de" suspeito, motivo em uma linha ---
import { suspeitaDoDe, fraseMotivo } from '../src/classificar.js';

test('suspeitaDoDe: anúncio bem acima do comum da loja, ou "de" que o produto nunca custou', () => {
  // KaBuM!: mediana 36%, p90 55%. -62% anunciado → suspeito; -40% → não
  assert.match(suspeitaDoDe({ preco: 380, de: 1000, anunciadoComumLoja: 0.36, anunciadoP90Loja: 0.55 }).motivo, /bem acima do comum dela \(-36%\)/);
  assert.equal(suspeitaDoDe({ preco: 600, de: 1000, anunciadoComumLoja: 0.36, anunciadoP90Loja: 0.55 }), null);
  // sem estatística da loja (poucas ofertas) não dá para dizer
  assert.equal(suspeitaDoDe({ preco: 380, de: 1000 }), null);
  // histórico: em 3 dias o maior preço visto foi 700, a loja diz "de 1000" → suspeito
  assert.match(suspeitaDoDe({ preco: 650, de: 1000, historico: { maximo: 700, dias: 3 } }).motivo, /nunca custou R\$ 1\.000,00/);
  // 1 dia só não basta; "de" até 2% acima do máximo também não
  assert.equal(suspeitaDoDe({ preco: 650, de: 1000, historico: { maximo: 700, dias: 1 } }), null);
  assert.equal(suspeitaDoDe({ preco: 650, de: 710, historico: { maximo: 700, dias: 5 } }), null);
  assert.equal(suspeitaDoDe({ preco: 100, de: 100 }), null);
});

test('classificar sem referência: suspeito quando há suspeita, senão sem_dados; sempre com motivo', () => {
  const s = classificar({ preco: 380, de: 1000, referencia: null, suspeita: { motivo: 'x' } });
  assert.equal(s.classe, 'suspeito'); assert.equal(s.motivo, 'x'); assert.equal(s.anunciado, 0.62);
  const n = classificar({ preco: 380, de: 1000, referencia: null, suspeita: null });
  assert.equal(n.classe, 'sem_dados'); assert.match(n.motivo, /nenhuma outra loja/);
});

test('classificar com 1 loja: mesma régua, motivo diz que é 1 loja e qual', () => {
  const c = classificar({ preco: 69.99, de: 199.9, referencia: 179.9, mercado: 179.9, base: 'loja_unica', lojas: 1, lojaRef: 'Americanas' });
  assert.equal(c.classe, 'imperdivel');
  assert.match(c.motivo, /^61% abaixo do preço na Americanas \(R\$ 179,90\) · só 1 loja comparada$/);
  assert.ok(c.motivos.includes('comparado com 1 loja (Americanas)'));
  const f = classificar({ preco: 179, de: 250, referencia: 179.9, mercado: 179.9, base: 'loja_unica', lojas: 1, lojaRef: 'Americanas' });
  assert.equal(f.classe, 'falso'); assert.match(f.motivo, /loja diz -28%, mas Americanas vende por R\$ 179,90 hoje/);
  const igual = classificar({ preco: 100, de: 105, referencia: 100, mercado: 100, base: 'loja_unica', lojas: 1, lojaRef: 'Americanas' });
  assert.equal(igual.classe, 'sem_desconto'); assert.match(igual.motivo, /mesmo preço na Americanas/);
  assert.match(fraseMotivo({ classe: 'otimo', real: 0.2, anunciado: 0.3, referencia: 125, base: 'mercado', lojas: 3 }), /20% abaixo do preço em 3 lojas hoje \(R\$ 125,00\)/);
});
