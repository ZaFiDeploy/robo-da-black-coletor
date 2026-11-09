import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarPorDepartamento, entraNaVitrine } from '../src/exportar.js';

const o = (id, top, classe, loja = 'Mercado Livre') => ({ id, chave: 'k' + id, nome: 'P' + id, cat: 'tv', top, loja, preco: 100, de: 150, url: 'https://x/' + id, img: null, classe, real: classe === 'imperdivel' ? 0.4 : null, anunciado: 0.33, score: 88, faixa: 'seguro', referencia: classe === 'imperdivel' ? 170 : null, lojas: 0, relampago: id === 1, checadoEm: 'x' });

test('saída por departamento: um arquivo por top, índice com contagens e lojas', () => {
  const { indice, arquivos } = montarPorDepartamento({ ofertas: [o(1, 'MLB1000', 'imperdivel'), o(2, 'MLB1000', 'sem_dados'), o(3, 'MLB1574', 'sem_dados', 'KaBuM!'), o(4, null, 'sem_dados')] }, { agora: new Date('2026-11-07T20:00:00Z') });
  assert.deepEqual(Object.keys(arquivos).sort(), ['ofertas-MLB1000.json', 'ofertas-MLB1574.json', 'ofertas-outros.json']);
  assert.equal(indice.total, 4); assert.equal(indice.checadas, 1);
  assert.equal(indice.porDepartamento.MLB1000.n, 2); assert.equal(indice.porDepartamento.MLB1000.checadas, 1);
  assert.deepEqual(indice.lojas, ['Mercado Livre', 'KaBuM!']);
  assert.deepEqual(indice.relampago, [1]);
  assert.equal(arquivos['ofertas-MLB1574.json'].ofertas[0].classe, 'nao_checado'); // sem_dados vira nao_checado no app
});

test('vitrine: não checada só entra com loja segura e desconto anunciado', () => {
  assert.equal(entraNaVitrine({ classe: 'sem_dados', score: 72, anunciado: 0.3 }), true);
  assert.equal(entraNaVitrine({ classe: 'sem_dados', score: 40, anunciado: 0.3 }), false);
  assert.equal(entraNaVitrine({ classe: 'sem_dados', score: 90, anunciado: 0 }), false);
});

test('vitrine: suspeito entra como nao_checado (compatível) com veredito e motivo; sem_desconto só com referência e anúncio', () => {
  assert.equal(entraNaVitrine({ classe: 'suspeito', score: 72, anunciado: 0.6 }), true);
  assert.equal(entraNaVitrine({ classe: 'suspeito', score: 50, anunciado: 0.6 }), false);
  assert.equal(entraNaVitrine({ classe: 'sem_desconto', referencia: 100, anunciado: 0.07 }), true);
  assert.equal(entraNaVitrine({ classe: 'sem_desconto', referencia: 100, anunciado: 0 }), false);
  const { arquivos } = montarPorDepartamento({ ofertas: [{ ...o(9, 'MLB1000', 'suspeito'), motivo: 'loja diz -60%' }] }, { agora: new Date('2026-11-08T20:00:00Z') });
  const s = arquivos['ofertas-MLB1000.json'].ofertas[0];
  assert.equal(s.classe, 'nao_checado'); assert.equal(s.veredito, 'suspeito'); assert.equal(s.motivo, 'loja diz -60%');
});
