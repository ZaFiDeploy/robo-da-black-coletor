import { test } from 'node:test';
import assert from 'node:assert/strict';
import { termoBusca, candidatosVtex, casar, cruzar, ean14 } from '../src/fontes/vtex-busca.js';

const robots = 'User-agent: *\nDisallow: /checkout\nAllow: /\n';
const produtoVtex = (nome, ean, preco, de, disp = 1, marca = 'Kingston') => ({
  productName: nome, brand: marca, link: 'https://www.americanas.com.br/' + nome.toLowerCase().replace(/\s+/g, '-') + '/p',
  items: [{ name: nome, ean, images: [{ imageUrl: 'https://img/x.jpg' }], sellers: [{ sellerName: 'Loja', commertialOffer: { Price: preco, ListPrice: de, AvailableQuantity: disp } }] }]
});

test('termoBusca: marca + modelo quando dá; senão as 5 primeiras palavras úteis', () => {
  assert.equal(termoBusca({ titulo: 'Monitor Gamer AOC 24G2, 24", 144Hz' }), 'aoc 24g2');
  assert.equal(termoBusca({ titulo: 'SSD Kingston A400, 480GB, Sata III, 2.5"' }), 'ssd kingston a400 480gb sata'); // marca fora da lista: palavras do título
  assert.equal(termoBusca({ titulo: 'Caneca de Porcelana Branca Lisa' }), 'caneca porcelana branca lisa');
  assert.equal(termoBusca({ titulo: 'Kit' }), null);
});

test('candidatosVtex: só SKU disponível com preço > 0, vendedor mais barato, EAN válido e "de" só se maior', () => {
  const json = [
    produtoVtex('Ssd Kingston A400 480GB', '0740617261219', 0, 0, 0),          // sem estoque → fora
    { ...produtoVtex('Ssd Kingston A400 480GB', '0740617261219', 300, 300), items: [{ name: 'x', ean: '0740617261219', sellers: [
      { sellerName: 'A', commertialOffer: { Price: 320, ListPrice: 399, AvailableQuantity: 2 } },
      { sellerName: 'B', commertialOffer: { Price: 300, ListPrice: 300, AvailableQuantity: 5 } }] }] },
    produtoVtex('Outro', 'abc', 50, 80)
  ];
  const c = candidatosVtex(json, 'Americanas');
  assert.equal(c.length, 2);
  assert.equal(c[0].preco, 300); assert.equal(c[0].vendedor, 'B'); assert.equal(c[0].de, null); assert.equal(c[0].loja, 'Americanas');
  assert.equal(c[1].ean, null); assert.equal(c[1].de, 80);
});

test('casar: por EAN só EAN igual; por texto exige marca/modelo e preço dentro de 1/3 a 3×; nunca "parecido"', () => {
  const nossa = { titulo: 'SSD Kingston A400 480GB Sata III', ean: '740617261219', preco: 250, loja: 'KaBuM!' };
  const cands = candidatosVtex([produtoVtex('Ssd Kingston A400 480GB', '0740617261219', 300, 350), produtoVtex('Ssd Kingston A400 240GB', '0740617261202', 150, 150)], 'Americanas');
  const p = casar(nossa, cands);
  assert.equal(p.por, 'ean'); assert.equal(p.outra.preco, 300);
  // sem EAN nosso: texto. 240GB tem atributo em conflito (480gb x 240gb) → fora; 480GB casa por modelo
  const semEan = { titulo: 'SSD Kingston A400 480GB Sata III', preco: 250, loja: 'KaBuM!' };
  const q = casar(semEan, cands.map((c) => ({ ...c, ean: null })));
  assert.equal(q.por, 'modelo'); assert.equal(q.outra.preco, 300);
  // preço fora da razão (acessório a R$ 20) não casa
  assert.equal(casar(semEan, [{ ...cands[0], ean: null, preco: 20 }]), null);
  // marca diferente não casa
  assert.equal(casar({ titulo: 'SSD Samsung 870 EVO 500GB', preco: 300 }, [{ ...cands[0], ean: null }]), null);
  assert.equal(ean14('673419232845'), ean14('0673419232845'));
});

test('cruzar: robots → pedido por EAN ou texto → par; para no 1º 403', async () => {
  const pedidos = [];
  const fakeFetch = async (url) => {
    pedidos.push(url);
    if (url.endsWith('/robots.txt')) return { ok: true, status: 200, text: async () => robots };
    if (url.includes('alternateIds_Ean:740617261219')) return { status: 200, text: async () => JSON.stringify([produtoVtex('Ssd Kingston A400 480GB', '0740617261219', 300, 350)]) };
    if (url.includes('ft=')) return { status: 403, text: async () => '' };
    return { status: 200, text: async () => '[]' };
  };
  const ofertas = [
    { titulo: 'SSD Kingston A400 480GB', ean: '740617261219', preco: 250, loja: 'KaBuM!', url: 'https://www.kabum.com.br/produto/1' },
    { titulo: 'Pneu Sunset', preco: 400, loja: 'Americanas', url: 'https://www.americanas.com.br/x/p' },   // mesma loja: pulada
    { titulo: 'Mouse Logitech G203', preco: 120, loja: 'KaBuM!', url: 'https://www.kabum.com.br/produto/2' },   // texto → 403 → para
    { titulo: 'Monitor AOC 24G2', preco: 900, loja: 'KaBuM!', url: 'https://www.kabum.com.br/produto/3' }
  ];
  const logs = [];
  const pares = await cruzar({ loja: 'americanas', ofertas, fetchFn: fakeFetch, pausaMs: 1, log: (m) => logs.push(m) });
  assert.equal(pares.length, 1);
  assert.equal(pares[0].url, 'https://www.kabum.com.br/produto/1'); assert.equal(pares[0].por, 'ean'); assert.equal(pares[0].outra.loja, 'Americanas'); assert.equal(pares[0].outra.preco, 300);
  assert.equal(pedidos.filter((u) => u.includes('/api/')).length, 2, 'parou no 403: o 3º produto não foi pedido');
  assert.ok(logs.some((m) => /bloqueado \(403\)/.test(m)));
});

test('cruzar: robots proibindo a API → nenhum pedido', async () => {
  const pedidos = [];
  const fakeFetch = async (url) => { pedidos.push(url); return { ok: true, status: 200, text: async () => 'User-agent: *\nDisallow: /api/\n' }; };
  const pares = await cruzar({ loja: 'rihappy', ofertas: [{ titulo: 'Lego 10700', ean: '673419232845', preco: 50, loja: 'KaBuM!', url: 'u' }], fetchFn: fakeFetch, pausaMs: 1 });
  assert.deepEqual(pares, []);
  assert.equal(pedidos.length, 1);
});
