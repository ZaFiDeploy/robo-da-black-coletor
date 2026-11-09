import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comAfiliado } from '../src/afiliado.js';

test('Amazon ganha a tag e vira link limpo do produto', () => {
  assert.equal(comAfiliado('https://www.amazon.com.br/Air-Fryer-Mondial/dp/B0ABCDE123/ref=sr_1_3?keywords=air&qid=1', { amazonTag: 'cacablack-20' }),
    'https://www.amazon.com.br/dp/B0ABCDE123?tag=cacablack-20');
  assert.equal(comAfiliado('https://amazon.com.br/gp/product/b0abcde123?tag=outro-20', { amazonTag: 'cacablack-20' }),
    'https://www.amazon.com.br/dp/B0ABCDE123?tag=cacablack-20');
});

test('outras lojas e lixo passam sem mudar', () => {
  assert.equal(comAfiliado('https://www.mercadolivre.com.br/p/MLB19466433'), 'https://www.mercadolivre.com.br/p/MLB19466433');
  assert.equal(comAfiliado('https://s.shopee.com.br/abc123'), 'https://s.shopee.com.br/abc123');
  assert.equal(comAfiliado('não é link'), 'não é link');
});
