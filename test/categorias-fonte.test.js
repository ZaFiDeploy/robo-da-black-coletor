import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoriaInterna, classificarCategorias } from '../src/categorias-fonte.js';
import { avaliar } from '../src/motor.js';

test('categoria da loja vira cat/top interno', () => {
  assert.deepEqual(categoriaInterna({ catLoja: 'TV', titulo: 'Smart TV LG' }), { cat: 'tv', top: 'MLB1000', por: 'categoria' });
  assert.equal(categoriaInterna({ catLoja: 'Hardware', titulo: 'SSD Kingston 1TB' }).cat, 'informatica');
  assert.equal(categoriaInterna({ catLoja: 'Eletroportáteis', titulo: 'Air Fryer Mondial' }).cat, 'eletro');
  assert.equal(categoriaInterna({ caminhoLoja: ['Casa', 'Cama, Mesa e Banho'], titulo: 'Jogo de lençol' }).cat, 'moveis');
});

test('sem categoria da loja, cai no título; sem nada, outros', () => {
  assert.deepEqual(categoriaInterna({ titulo: 'Tênis Nike Revolution' }), { cat: 'moda', top: 'MLB1430', por: 'titulo' });
  assert.equal(categoriaInterna({ titulo: 'Coisa indefinida' }).cat, 'outros');
});

test('ofertas de 3 fontes com o mesmo EAN viram um produto e geram preço de mercado', () => {
  const cruas = classificarCategorias([
    { loja: 'KaBuM!', titulo: 'Smart TV LG 50" 4K UN85C', ean: '7891000100103', catLoja: 'TV', preco: 2399, de: 2999, url: 'https://www.kabum.com.br/produto/1' },
    { loja: 'Mercado Livre', titulo: 'Smart TV LG 50 4K UN85C', ean: '7891000100103', cat: 'tv', top: 'MLB1000', preco: 2215, de: 3424, url: 'https://www.mercadolivre.com.br/p/MLB74962073' },
    { loja: 'Americanas', titulo: 'TV LG 50UN85C 4K', ean: '7891000100103', catLoja: 'TV e Vídeo', preco: 2290, de: 2290, url: 'https://www.americanas.com.br/produto/9' }
  ]);
  assert.equal(cruas[0].cat, 'tv'); assert.equal(cruas[0].top, 'MLB1000');
  const { ofertas } = avaliar(cruas);
  const ml = ofertas.find((o) => o.loja === 'Mercado Livre');
  assert.equal(ml.lojas, 2);                       // KaBuM! e Americanas
  assert.equal(ml.mercado, (2399 + 2290) / 2);     // mediana das outras duas
  assert.equal(ml.classe, 'bom');                   // 2215 é ~5,5% abaixo
  assert.equal(new Set(ofertas.map((o) => o.chave)).size, 1, 'mesmo produto');
});
