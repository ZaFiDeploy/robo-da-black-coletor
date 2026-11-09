import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisarUrl, scoreSeguranca } from '../src/score.js';

test('domínio verdadeiro de marketplace', () => {
  const u = analisarUrl('https://www.mercadolivre.com.br/p/MLB24047848');
  assert.equal(u.loja, 'Mercado Livre');
  assert.equal(u.imitaMarca, null);
});

test('domínio que imita marca', () => {
  assert.equal(analisarUrl('https://magalu-ofertas.shop/produto').imitaMarca, 'magalu');
  assert.equal(analisarUrl('https://mercadolivere.com/oferta').imitaMarca, 'mercadolivre');
  assert.equal(analisarUrl('https://www.americanas-blackfriday.com/x').imitaMarca, 'americanas');
});

test('loja oficial em marketplace = seguro', () => {
  const s = scoreSeguranca({ url: 'https://www.amazon.com.br/dp/X', lojaOficial: true });
  assert.equal(s.score, 95);
  assert.equal(s.faixa, 'seguro');
});

test('marketplace com reputação desconhecida = atenção', () => {
  assert.equal(scoreSeguranca({ url: 'https://www.mercadolivre.com.br/p/MLB1' }).score, 72);
});

test('golpe clássico: imita marca + só Pix + 70% abaixo do mercado', () => {
  const s = scoreSeguranca({ url: 'https://casasbahia-ofertas.online/tv', idadeDominioDias: 12, soPix: true, realVsMercado: 0.70 });
  assert.ok(s.score <= 15, `score ${s.score}`);
  assert.equal(s.faixa, 'evite');
});

test('site independente antigo, com CNPJ e cartão = atenção, não evite', () => {
  const s = scoreSeguranca({ url: 'https://www.lojadobairro.com.br/x', idadeDominioDias: 3000, temCnpj: true, soPix: false, realVsMercado: 0.1 });
  assert.equal(s.score, 60);
  assert.equal(s.faixa, 'atencao');
});

test('site novo (menos de 30 dias) trava em 25', () => {
  assert.ok(scoreSeguranca({ url: 'https://superofertasbr.com.br/x', idadeDominioDias: 10 }).score <= 25);
});

test('preço bom demais derruba até loja de marketplace', () => {
  const s = scoreSeguranca({ url: 'https://shopee.com.br/x', reputacao: 'nova', realVsMercado: 0.65 });
  assert.equal(s.score, 20);
});

test('sem https perde 30', () => {
  assert.equal(scoreSeguranca({ url: 'http://lojaantiga.com.br', idadeDominioDias: 4000 }).score, 30);
});

test('endereço sem ponto não quebra o score', () => {
  assert.equal(typeof scoreSeguranca({ url: 'https://localhost/x' }).score, 'number');
});

test('lojas oficiais validadas em 08/11 (Decathlon, Renner, Ri Happy, Cobasi…) pontuam como loja oficial', () => {
  for (const u of ['https://www.decathlon.com.br/camiseta/p', 'https://www.lojasrenner.com.br/p/x', 'https://www.rihappy.com.br/x/p', 'https://www.cobasi.com.br/x/p', 'https://www.tokstok.com.br/x/p', 'https://www.polishop.com.br/x/p']) {
    const s = scoreSeguranca({ url: u, preco: 100, referencia: 120, lojaOficial: true });
    assert.ok(s.score >= 80, u + ' → ' + s.score);
  }
});
