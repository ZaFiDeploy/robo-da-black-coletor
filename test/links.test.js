import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idDoLink } from '../src/links.js';

test('Mercado Livre: catálogo, produto do usuário e anúncio', () => {
  assert.equal(idDoLink('https://www.mercadolivre.com.br/p/MLB24047848?pdp_filters=deal').chave, 'mercadolivre:MLB24047848');
  assert.equal(idDoLink('https://www.mercadolivre.com.br/up/MLBU4089832378').tipo, 'up');
  assert.equal(idDoLink('https://produto.mercadolivre.com.br/MLB-3456789012-secadora-electrolux-_JM').chave, 'mercadolivre:MLB3456789012');
});

test('Amazon, Shopee, KaBuM!, Magalu, Americanas', () => {
  assert.equal(idDoLink('https://www.amazon.com.br/Smart-TV-LG/dp/B0CXYZ1234/ref=sr_1_1?tag=x').chave, 'amazon:B0CXYZ1234');
  assert.equal(idDoLink('https://shopee.com.br/Creatina-Soldiers-1kg-i.123456.7891011').chave, 'shopee:123456.7891011');
  assert.equal(idDoLink('https://www.kabum.com.br/produto/123456/monitor-aoc').chave, 'kabum:123456');
  assert.equal(idDoLink('https://www.magazineluiza.com.br/smart-tv/p/237184400/et/tv4k/').chave, 'magalu:237184400');
  assert.equal(idDoLink('https://www.americanas.com.br/produto/7531234').chave, 'americanas:7531234');
});

test('link dentro de texto colado do WhatsApp, sem https e com rastreio', () => {
  assert.equal(idDoLink('olha essa: https://www.amazon.com.br/dp/B0CXYZ1234?ref=abc 🔥').chave, 'amazon:B0CXYZ1234');
  assert.equal(idDoLink('kabum.com.br/produto/99887').chave, 'kabum:99887');
  assert.equal(idDoLink('https://www.mercadolivre.com.br/p/MLB24047848?utm_source=x').url, 'https://www.mercadolivre.com.br/p/MLB24047848');
});

test('encurtado volta marcado para seguir o redirecionamento', () => {
  assert.equal(idDoLink('https://amzn.to/3abcXYZ').tipo, 'encurtado');
  assert.equal(idDoLink('https://s.shopee.com.br/abc123').tipo, 'encurtado');
});

test('outro site vira "outra" (vai para o score de segurança); lixo vira null', () => {
  assert.equal(idDoLink('https://magalu-ofertas.shop/tv').loja, 'outra');
  assert.equal(idDoLink('não é link'), null);
  assert.equal(idDoLink('oi'), null);
});

test('lojas monitoradas pelo robô educado: o id é o caminho da página do produto (.../p)', () => {
  assert.equal(idDoLink('https://www.rihappy.com.br/inalador-nebplus-multikids/p').chave, 'rihappy:inalador-nebplus-multikids');
  assert.equal(idDoLink('https://www.rihappy.com.br/inalador-nebplus-multikids/p?utm=x').chave, 'rihappy:inalador-nebplus-multikids');
  assert.equal(idDoLink('https://www.americanas.com.br/inalador-compressor-nebplus-1786z1160309dd28/p').chave, 'americanas:inalador-compressor-nebplus-1786z1160309dd28');
  assert.equal(idDoLink('https://www.americanas.com.br/produto/7531234').chave, 'americanas:7531234');
  assert.equal(idDoLink('https://www.lojasrenner.com.br/p/camisa-x/-/A-123').chave, 'lojasrenner:p/camisa-x/-/a-123');
  assert.equal(idDoLink('https://www.cobasi.com.br/racao-golden/p').loja, 'cobasi');
  assert.equal(idDoLink('https://www.decathlon.com.br/').loja, 'decathlon'); // home: id vazio → null
});
