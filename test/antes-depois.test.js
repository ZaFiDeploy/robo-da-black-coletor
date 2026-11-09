import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compararAntesDepois, serieDiaria } from '../src/antes-depois.js';

const agora = new Date('2026-11-27T15:00:00-03:00');
// precos[0] = dia mais antigo; o último é ontem
const hist = (precos) => precos.map((preco, i) => ({ preco, em: new Date(agora - (precos.length - i) * 864e5).toISOString() }));

test('série diária: menor preço do dia no fuso de São Paulo', () => {
  const s = serieDiaria([
    { preco: 100, em: '2026-11-20T01:00:00Z' }, // 19/11 22h em SP
    { preco: 90, em: '2026-11-20T02:30:00Z' },  // 19/11 23h30 em SP
    { preco: 95, em: '2026-11-20T12:00:00Z' }   // 20/11
  ]);
  assert.deepEqual(s, [{ dia: '2026-11-19', preco: 90 }, { dia: '2026-11-20', preco: 95 }]);
});

test('menos de 5 dias: ainda não dá veredito, diz quando dá', () => {
  const r = compararAntesDepois({ historico: hist([1000, 1000, 1000]), precoAgora: 900, agora });
  assert.equal(r.veredito, 'sem_historico');
  assert.match(r.frase, /Em 2 dias mostramos/);
});

test('caiu de verdade', () => {
  const r = compararAntesDepois({ historico: hist(Array(10).fill(1000)), precoAgora: 800, agora });
  assert.equal(r.veredito, 'caiu');
  assert.equal(r.menorPreco, true);
  assert.match(r.frase, /Caiu 20% de verdade: custava R\$ 1\.000,00, agora R\$ 800,00/);
});

test('mesmo preço com "-45%" da loja = falso', () => {
  const r = compararAntesDepois({ historico: hist(Array(10).fill(1000)), precoAgora: 990, de: 1800, agora });
  assert.equal(r.veredito, 'igual');
  assert.match(r.frase, /"-45%" da loja é falso/);
});

test('mais caro que antes', () => {
  const r = compararAntesDepois({ historico: hist(Array(10).fill(1000)), precoAgora: 1100, de: 1500, agora });
  assert.equal(r.veredito, 'subiu');
  assert.match(r.frase, /10% mais caro/);
});

test('maquiagem: subiu e "baixou" de volta ao preço do começo', () => {
  const r = compararAntesDepois({ historico: hist([1000, 1000, 1000, 1300, 1300, 1300, 1300, 1300, 1300, 1300]), precoAgora: 1010, de: 1300, agora });
  assert.equal(r.veredito, 'maquiagem');
  assert.equal(r.inicio, 1000);
  assert.equal(r.pico, 1300);
  assert.match(r.frase, /subiu de R\$ 1\.000,00 para R\$ 1\.300,00/);
});

test('oscilação pequena não é maquiagem', () => {
  const r = compararAntesDepois({ historico: hist([1000, 1000, 1000, 1050, 1050, 1000, 1000]), precoAgora: 1000, agora });
  assert.equal(r.veredito, 'igual');
});

test('queda de verdade depois de subir (abaixo do começo) é "caiu", não maquiagem', () => {
  const r = compararAntesDepois({ historico: hist([1000, 1000, 1000, 1300, 1300, 1300, 1300]), precoAgora: 800, agora });
  assert.equal(r.veredito, 'caiu');
});

test('o preço de hoje não entra no "antes"', () => {
  const h = [...hist(Array(6).fill(1000)), { preco: 500, em: new Date(agora - 3600e3).toISOString() }];
  assert.equal(compararAntesDepois({ historico: h, precoAgora: 500, agora }).antes, 1000);
});
