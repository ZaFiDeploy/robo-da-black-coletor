import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokens, eanValido, chaveProduto, modeloDe, marcaDe, mesmoProduto, atributos } from '../src/normalizar.js';

test('unidades viram o mesmo token', () => {
  assert.ok(tokens('Galaxy A36 128 GB').includes('128gb'));
  assert.ok(tokens('Galaxy A36 128gb').includes('128gb'));
  assert.ok(tokens('Ar 12.000 BTUs').includes('12000btu'));
  assert.ok(tokens('Smart TV 50" 4K').includes('50pol'));
  assert.ok(tokens('Monitor 27 polegadas').includes('27pol'));
});

test('palavras de vitrine somem', () => {
  assert.deepEqual(tokens('NOVO Original Frete Grátis Airfryer Mondial 4L'), ['airfryer', 'mondial', '4l']);
});

test('EAN: dígito verificador', () => {
  assert.equal(eanValido('7891000100103'), true);   // EAN-13 válido
  assert.equal(eanValido('7891000100104'), false);  // dígito errado
  assert.equal(eanValido('0000000000000'), false);
  assert.equal(eanValido(''), false);
  assert.equal(eanValido('96385074'), true);        // EAN-8 válido
});

test('marca e modelo saem do título', () => {
  assert.equal(marcaDe('Secadora Electrolux 11 kg Essential Care STL11'), 'electrolux');
  assert.equal(modeloDe('Secadora Electrolux 11 kg Essential Care STL11'), 'stl11');
  assert.equal(modeloDe('Samsung Galaxy A36 5G, 128 GB, 6 GB RAM'), 'a36');
  assert.equal(modeloDe('Smart TV LG 50" 4K UN85C'), 'un85c');
  assert.equal(marcaDe('Lavadora Kärcher Compacta'), 'karcher');
});

test('chave do produto: EAN > marca+modelo > título', () => {
  assert.equal(chaveProduto({ titulo: 'x', ean: '7891000100103' }).chave, 'ean:07891000100103');
  assert.equal(chaveProduto({ titulo: 'Câmera TP-Link Tapo C320WS 2K' }).chave, 'mod:tp-link|c320ws');
  assert.notEqual(chaveProduto({ titulo: 'Samsung Galaxy A36 128GB' }).chave, chaveProduto({ titulo: 'Samsung Galaxy A36 256GB' }).chave);
  assert.equal(chaveProduto({ titulo: 'Jogo de toalhas Village 4 peças' }).confianca, 'baixa');
});

test('mesmo produto em lojas diferentes (títulos diferentes)', () => {
  const ml = { titulo: 'Samsung Galaxy A36 5G, 128 GB, 6 GB RAM' };
  const amz = { titulo: 'Smartphone Samsung Galaxy A36 5G 128GB 6GB Preto' };
  assert.equal(mesmoProduto(ml, amz).mesmo, true);
});

test('capacidade diferente nunca é o mesmo produto', () => {
  const r = mesmoProduto({ titulo: 'Samsung Galaxy A36 5G 128GB' }, { titulo: 'Samsung Galaxy A36 5G 256GB' });
  assert.equal(r.mesmo, false);
  assert.equal(r.por, 'atributo');
});

test('voltagem diferente nunca é o mesmo produto', () => {
  assert.equal(mesmoProduto({ titulo: 'Airfryer Mondial AFN-40 4L 110V' }, { titulo: 'Airfryer Mondial AFN-40 4L 220V' }).mesmo, false);
  assert.deepEqual(atributos('Ar Midea 12000 BTUs 220V').voltagem, ['220']);
});

test('EAN diferente vence título parecido', () => {
  const r = mesmoProduto({ titulo: 'Creatina 1kg', ean: '7891000100103' }, { titulo: 'Creatina 1kg', ean: '96385074' });
  assert.equal(r.mesmo, false);
});

test('modelo diferente da mesma marca', () => {
  assert.equal(mesmoProduto({ titulo: 'Samsung Galaxy A36 5G' }, { titulo: 'Samsung Galaxy A17 5G' }).mesmo, false);
});
