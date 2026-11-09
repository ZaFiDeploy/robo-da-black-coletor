import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerRobots, permitido } from '../src/robots.js';
import { produtoDoJsonLd, categoriasDoJsonLd } from '../src/jsonld.js';
import { coletar, Bloqueado } from '../src/fontes/sitemap.js';

const fixture = readFileSync(new URL('./fixtures/kabum-produto.html', import.meta.url), 'utf8');

test('robots: regra mais longa vence; sem grupo = liberado', () => {
  const g = lerRobots(`User-agent: *\nDisallow: /ofertas?\nDisallow: /*?awc=*\nAllow: /produto/\nDisallow: /produto/secreto\nCrawl-delay: 2\n\nUser-agent: Googlebot\nDisallow:`);
  assert.equal(permitido(g, '/ofertas?category=MLB1'), false);
  assert.equal(permitido(g, '/x?awc=abc'), false);
  assert.equal(permitido(g, '/produto/123?awc=abc'), true); // regra mais longa (/produto/) vence, como no padrão
  assert.equal(permitido(g, '/produto/123/tv'), true);
  assert.equal(permitido(g, '/produto/secreto/1'), false);
  assert.equal(permitido(g, '/qualquer'), true);
  assert.equal(permitido([], '/ofertas?x'), true);
  assert.equal(g[0].delay, 2);
});

test('robots: grupo com o nosso nome vence o "*"', () => {
  const g = lerRobots(`User-agent: *\nDisallow: /\n\nUser-agent: robo-da-black-coletor\nAllow: /produto/`);
  assert.equal(permitido(g, '/produto/1'), true);
  assert.equal(permitido(g, '/busca'), true); // o grupo do nosso nome só tem Allow; o resto não é proibido
  assert.equal(permitido(g, '/busca', 'outro-robo'), false);
});

test('JSON-LD do KaBuM!: produto, preço, marca, foto e categoria', () => {
  const p = produtoDoJsonLd(fixture);
  assert.equal(p.preco, 2599);
  assert.match(p.titulo, /Smart Tv Lg 4k/);
  assert.equal(p.marca, 'LG');
  assert.match(p.img, /^https:\/\/images\.kabum\.com\.br/);
  assert.equal(p.disponivel, true);
  assert.deepEqual(categoriasDoJsonLd(fixture), ['TV']);
});

test('JSON-LD com preço riscado em priceSpecification e gtin', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'X', gtin13: '7891000100103', offers: { '@type': 'Offer', price: '99,90', priceSpecification: [{ '@type': 'UnitPriceSpecification', priceType: 'https://schema.org/StrikethroughPrice', price: 149.9 }] } })}</script>`;
  const p = produtoDoJsonLd(html);
  assert.equal(p.preco, 99.9); assert.equal(p.de, 149.9); assert.equal(p.ean, '7891000100103');
});

function fakeFetch(mapa) {
  return async (url) => {
    const r = mapa[url] ?? { status: 404, body: '' };
    return { status: r.status, ok: r.status === 200, url, text: async () => r.body };
  };
}
const robots = 'User-agent: *\nDisallow: /busca\nAllow: /';
const idx = '<sitemapindex><sitemap><loc>https://www.kabum.com.br/sitemap/tv.xml</loc></sitemap></sitemapindex>';
const tv = '<urlset><url><loc>https://www.kabum.com.br/tv</loc></url><url><loc>https://www.kabum.com.br/produto/1081146/smart-tv</loc></url><url><loc>https://www.kabum.com.br/produto/2/x</loc></url></urlset>';

test('sitemap educada: respeita robots, lê JSON-LD, pega o "de" do KaBuM!', async () => {
  const log = [];
  const f = fakeFetch({
    'https://www.kabum.com.br/robots.txt': { status: 200, body: robots },
    'https://www.kabum.com.br/sitemap.xml': { status: 200, body: idx },
    'https://www.kabum.com.br/sitemap/tv.xml': { status: 200, body: tv },
    'https://www.kabum.com.br/produto/1081146/smart-tv': { status: 200, body: fixture.replace('"oldPrice":0', '"oldPrice":2999') },
    'https://www.kabum.com.br/produto/2/x': { status: 200, body: '<html>sem json-ld</html>' }
  });
  const r = await coletar({ loja: 'kabum', limite: 10, fetchFn: f, log: (m) => log.push(m), pausaMs: 1 });
  assert.equal(r.length, 1);
  assert.equal(r[0].preco, 2599); assert.equal(r[0].de, 2999); assert.equal(r[0].loja, 'KaBuM!'); assert.equal(r[0].catLoja, 'TV');
  assert.equal(r[0].vendedor.nome, 'Engage Eletro'); assert.equal(r[0].vendedor.oficial, false); // marketplace dentro do KaBuM!
});

test('sitemap educada: robots proíbe → não coleta; 403 → para na hora', async () => {
  const f1 = fakeFetch({ 'https://www.kabum.com.br/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /' } });
  assert.deepEqual(await coletar({ loja: 'kabum', fetchFn: f1, pausaMs: 1 }), []);
  const log = [];
  const f2 = fakeFetch({
    'https://www.kabum.com.br/robots.txt': { status: 200, body: robots },
    'https://www.kabum.com.br/sitemap.xml': { status: 200, body: idx },
    'https://www.kabum.com.br/sitemap/tv.xml': { status: 200, body: tv },
    'https://www.kabum.com.br/produto/1081146/smart-tv': { status: 403, body: '' },
    'https://www.kabum.com.br/produto/2/x': { status: 200, body: fixture }
  });
  const r = await coletar({ loja: 'kabum', fetchFn: f2, log: (m) => log.push(m), pausaMs: 1 });
  assert.equal(r.length, 0, 'depois do 403 não tenta a próxima');
  assert.ok(log.some((m) => /bloqueado \(403\)/.test(m)));
  assert.ok(new Bloqueado('x', 429, 'u') instanceof Error);
});

test('JSON-LD da Americanas (VTEX): gtin, marca "Não Disponível" vira null, sem estoque = sem preço', () => {
  const html = readFileSync(new URL('./fixtures/americanas-produto.html', import.meta.url), 'utf8');
  assert.equal(produtoDoJsonLd(html), null); // price "0" / OutOfStock: não entra
  const comPreco = html.replace('"price":"0"', '"price":"399,90"');
  const p = produtoDoJsonLd(comPreco);
  assert.equal(p.preco, 399.9); assert.equal(p.ean, '7898361098919'); assert.equal(p.marca, null);
});

test('JSON-LD do Carrefour (VTEX): preço, marca, mpn', () => {
  const p = produtoDoJsonLd(readFileSync(new URL('./fixtures/carrefour-produto.html', import.meta.url), 'utf8'));
  assert.equal(p.preco, 146.9); assert.equal(p.marca, 'Electrolux'); assert.equal(p.modelo, 'MP01955023');
});

test('preço em texto: "476.45" é 476,45 e "1.299,90" é 1299,90', () => {
  const mk = (price) => `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'X', offers: { '@type': 'Offer', price } })}</script>`;
  assert.equal(produtoDoJsonLd(mk('476.45')).preco, 476.45);
  assert.equal(produtoDoJsonLd(mk('1.299,90')).preco, 1299.9);
  assert.equal(produtoDoJsonLd(mk('R$ 99,90')).preco, 99.9);
  assert.equal(produtoDoJsonLd(mk(2599)).preco, 2599);
});

test('porSitemap espalha a coleta: no máximo N páginas por subsitemap', async () => {
  const dois = '<urlset><url><loc>https://www.kabum.com.br/produto/1/a</loc></url><url><loc>https://www.kabum.com.br/produto/2/b</loc></url><url><loc>https://www.kabum.com.br/produto/3/c</loc></url></urlset>';
  const f = fakeFetch({
    'https://www.kabum.com.br/robots.txt': { status: 200, body: robots },
    'https://www.kabum.com.br/sitemap.xml': { status: 200, body: '<sitemapindex><sitemap><loc>https://www.kabum.com.br/sitemap/a.xml</loc></sitemap><sitemap><loc>https://www.kabum.com.br/sitemap/b.xml</loc></sitemap></sitemapindex>' },
    'https://www.kabum.com.br/sitemap/a.xml': { status: 200, body: dois }, 'https://www.kabum.com.br/sitemap/b.xml': { status: 200, body: dois.replace(/produto\/(\d)/g, 'produto/1$1') },
    'https://www.kabum.com.br/produto/1/a': { status: 200, body: fixture }, 'https://www.kabum.com.br/produto/11/a': { status: 200, body: fixture },
    'https://www.kabum.com.br/produto/2/b': { status: 200, body: fixture }, 'https://www.kabum.com.br/produto/12/a': { status: 200, body: fixture }
  });
  const log = [];
  await coletar({ loja: 'kabum', limite: 10, porSitemap: 1, fetchFn: f, log: (m) => log.push(m), pausaMs: 1 });
  assert.ok(log.some((m) => /2 páginas de produto no plano/.test(m)), log.join(' / '));
});

test('bloqueio no sitemap não derruba o processo: para e devolve o que tem', async () => {
  const log = [];
  const f = fakeFetch({
    'https://www.kabum.com.br/robots.txt': { status: 200, body: robots },
    'https://www.kabum.com.br/sitemap.xml': { status: 503, body: '' }
  });
  assert.deepEqual(await coletar({ loja: 'kabum', fetchFn: f, log: (m) => log.push(m), pausaMs: 1 }), []);
  assert.ok(log.some((m) => /bloqueado \(503\)/.test(m)));
});

test('XML de sitemap nunca é confundido com captcha', async () => {
  const f = fakeFetch({
    'https://www.kabum.com.br/robots.txt': { status: 200, body: robots },
    'https://www.kabum.com.br/sitemap.xml': { status: 200, body: '<?xml version="1.0"?><!-- cloudflare challenge --><sitemapindex><sitemap><loc>https://www.kabum.com.br/sitemap/tv.xml</loc></sitemap></sitemapindex>' },
    'https://www.kabum.com.br/sitemap/tv.xml': { status: 200, body: tv },
    'https://www.kabum.com.br/produto/1081146/smart-tv': { status: 200, body: fixture }, 'https://www.kabum.com.br/produto/2/x': { status: 404, body: '' }
  });
  assert.equal((await coletar({ loja: 'kabum', fetchFn: f, pausaMs: 1 })).length, 1);
});

test('JSON-LD ProductGroup (Decathlon): preço vem da variante mais barata', () => {
  const p = produtoDoJsonLd(readFileSync(new URL('./fixtures/decathlon-produto.html', import.meta.url), 'utf8'));
  assert.ok(p && p.preco > 0, JSON.stringify(p));
  assert.equal(p.marca, 'Hurley');
});

test('"de" fora do JSON-LD: listPrice/oldPrice das lojas VTEX e Renner, escapado, em centavos; corte de 5%', async () => {
  const { LOJAS, dePorChave, deValido } = await import('../src/fontes/sitemap.js');
  assert.equal(LOJAS.rihappy.extra('x\\"listPrice\\":59.99,\\"price\\":39.91').de, 59.99);   // JSON escapado dentro de string
  assert.equal(LOJAS.cobasi.extra('"installmentsValue":4490,"listPrice":4490,"price":4490').de, 44.9); // centavos
  assert.equal(LOJAS.tokstok.extra('"oldPrice":999.9,"price":899.91').de, 999.9);
  assert.equal(LOJAS.lojasrenner.extra('"listPrice":755.17,"preLaunch":false').de, 755.17);
  assert.equal(LOJAS.americanas.extra('"listPrice":"79.99"').de, 79.99);                     // valor em string
  assert.deepEqual(dePorChave(['listPrice'])('<html>sem nada</html>'), {});
  assert.equal(deValido(79.99, 77.59), null);   // 3% = Pix, não é desconto
  assert.equal(deValido(59.99, 39.91), 59.99);
  assert.equal(deValido(4490, 44.9), null);     // leitura errada (100×) não vira "de"
  assert.equal(deValido(null, 10), null);
});

test('sitemap educada em loja VTEX: "de" vem do listPrice da página, não do JSON-LD', async () => {
  const pagina = `<html><script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Copo Avent', offers: { '@type': 'Offer', price: '39.91', availability: 'https://schema.org/InStock' } })}</script><script>self.__next_f.push("{\\"listPrice\\":59.99,\\"price\\":39.91}")</script></html>`;
  const f = fakeFetch({
    'https://www.rihappy.com.br/robots.txt': { status: 200, body: robots },
    'https://www.rihappy.com.br/sitemap.xml': { status: 200, body: '<sitemapindex><sitemap><loc>https://www.rihappy.com.br/sitemap/product-1.xml</loc></sitemap></sitemapindex>' },
    'https://www.rihappy.com.br/sitemap/product-1.xml': { status: 200, body: '<urlset><url><loc>https://www.rihappy.com.br/copo/p</loc></url></urlset>' },
    'https://www.rihappy.com.br/copo/p': { status: 200, body: pagina }
  });
  const r = await coletar({ loja: 'rihappy', fetchFn: f, pausaMs: 1 });
  assert.equal(r.length, 1); assert.equal(r[0].preco, 39.91); assert.equal(r[0].de, 59.99); assert.equal(r[0].loja, 'Ri Happy');
});
