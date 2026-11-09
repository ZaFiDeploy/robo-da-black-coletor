import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avaliar, agrupar, anuncioPorLoja } from '../src/motor.js';
import { montarSaida } from '../src/exportar.js';

const amostra = JSON.parse(readFileSync(new URL('../amostras/ml-2026-11-07.json', import.meta.url)));

// Régua que o app usa hoje (robo-da-black/app.js → avaliar). O motor tem de concordar com ela.
function regraDoApp(o) {
  const real = 1 - o.preco / o.mercado, anunciado = 1 - o.preco / o.de;
  if (anunciado >= 0.10 && real < 0.05) return 'falso';
  if (real >= 0.30) return 'imperdivel';
  if (real >= 0.15) return 'otimo';
  return 'bom';
}

test('amostra real de 07/11: motor concorda com a régua do app em todas as 17', () => {
  const { ofertas } = avaliar(amostra, { agora: new Date('2026-11-07T20:00:00Z') });
  assert.equal(ofertas.length, 17);
  for (const o of ofertas) {
    const crua = amostra.find((c) => c.url === o.url);
    assert.equal(o.classe, regraDoApp({ preco: crua.preco, de: crua.de, mercado: crua.comparacao.mercado }), o.nome);
  }
});

test('saída no formato do app (campos que o app lê)', () => {
  const r = avaliar(amostra, { agora: new Date('2026-11-07T20:00:00Z') });
  const { json, js } = montarSaida(r, { agora: new Date('2026-11-07T20:00:00Z') });
  for (const o of json.ofertas) {
    for (const k of ['id', 'nome', 'cat', 'loja', 'preco', 'de', 'mercado', 'lojas', 'url', 'img']) assert.ok(k in o, `${o.nome} sem ${k}`);
    assert.equal(typeof o.id, 'number');
  }
  assert.equal(new Set(json.ofertas.map((o) => o.id)).size, json.ofertas.length, 'ids únicos');
  assert.match(js, /^\/\/ Gerado/);
  assert.match(js, /window\.RB_OFERTAS = \[/);
});

test('ids estáveis entre rodadas', () => {
  const a = avaliar(amostra).ofertas.map((o) => o.id).sort();
  const b = avaliar(amostra).ofertas.map((o) => o.id).sort();
  assert.deepEqual(a, b);
});

test('mesmo produto em duas lojas vira um grupo e um vira o mercado do outro', () => {
  const cruas = [
    { loja: 'Mercado Livre', titulo: 'Samsung Galaxy A36 5G, 128 GB, 6 GB RAM', cat: 'celulares', preco: 1000, de: 2000, url: 'https://www.mercadolivre.com.br/p/MLB1' },
    { loja: 'Amazon', titulo: 'Smartphone Samsung Galaxy A36 5G 128GB 6GB', cat: 'celulares', preco: 1400, de: 1500, url: 'https://www.amazon.com.br/dp/A' },
    { loja: 'Magalu', titulo: 'Samsung Galaxy A36 128GB 6GB RAM 5G', cat: 'celulares', preco: 1500, de: 1600, url: 'https://www.magazineluiza.com.br/x' },
    { loja: 'Magalu', titulo: 'Samsung Galaxy A36 256GB 8GB RAM 5G', cat: 'celulares', preco: 1800, de: 1900, url: 'https://www.magazineluiza.com.br/y' }
  ];
  assert.equal(agrupar(cruas.map((o) => ({ ...o }))).length, 2);
  const ml = avaliar(cruas).ofertas.find((o) => o.loja === 'Mercado Livre');
  assert.equal(ml.mercado, 1450);   // mediana de Amazon 1400 e Magalu 1500
  assert.equal(ml.classe, 'imperdivel'); // 1 - 1000/1450 = 31%
});

test('busca cruzada: 1 outra loja vira referência "loja_unica" (nunca mercado); histórico da própria oferta é usado; "de" suspeito', () => {
  const agora = new Date('2026-11-08T20:00:00Z');
  const base = { fonte: 'sitemap-kabum', loja: 'KaBuM!', cat: 'informatica', img: null, vendedor: { oficial: true } };
  const cruas = [
    // Ri Happy R$ 69,99 "de" 199,90; Americanas vende por 179,90 → imperdível com base loja_unica
    { ...base, loja: 'Ri Happy', titulo: 'Inalador Nebplus Multikids', ean: '7899838832845', preco: 69.99, de: 199.9, url: 'https://www.rihappy.com.br/inalador/p', comparacao: { outras: [{ loja: 'Americanas', preco: 179.9, url: 'https://www.americanas.com.br/inalador/p' }] } },
    // loja anuncia -30% mas a Americanas vende pelo mesmo preço → falso
    { ...base, titulo: 'Mouse Logitech G203 Lightsync', preco: 140, de: 200, url: 'https://www.kabum.com.br/produto/1', comparacao: { outras: [{ loja: 'Americanas', preco: 141 }] } },
    // sem comparação, "de" nunca visto em 3 dias → suspeito
    { ...base, titulo: 'Teclado Redragon Kumara K552', preco: 180, de: 400, url: 'https://www.kabum.com.br/produto/2', historico: [{ preco: 199, em: '2026-11-06T12:00:00Z' }, { preco: 190, em: '2026-11-07T12:00:00Z' }, { preco: 180, em: '2026-11-08T12:00:00Z' }] },
    // sem comparação, sem histórico → sem dados
    { ...base, titulo: 'Headset HyperX Cloud II', preco: 300, de: 400, url: 'https://www.kabum.com.br/produto/3' }
  ];
  const { ofertas } = avaliar(cruas, { agora });
  const por = (t) => ofertas.find((o) => o.nome.startsWith(t));
  const inal = por('Inalador');
  assert.equal(inal.base, 'loja_unica'); assert.equal(inal.lojas, 1); assert.equal(inal.lojaRef, 'Americanas'); assert.equal(inal.classe, 'imperdivel'); assert.equal(inal.referencia, 179.9);
  assert.equal(inal.outra, null, '"outra" só quando a outra loja é mais barata');
  assert.match(inal.motivo, /só 1 loja comparada/);
  assert.equal(inal.relampago, false, '1 loja comparada nunca vira Relâmpago');
  assert.equal(por('Mouse').classe, 'falso'); assert.match(por('Mouse').motivo, /Americanas vende por R\$ 141,00/);
  assert.equal(por('Teclado').classe, 'suspeito'); assert.match(por('Teclado').motivo, /em 3 dias vigiando nunca custou R\$ 400,00/);
  assert.equal(por('Headset').classe, 'sem_dados'); assert.match(por('Headset').motivo, /nenhuma outra loja/);
  const { json } = montarSaida({ ofertas }, { agora });
  const t = json.ofertas.find((o) => o.nome.startsWith('Teclado'));
  assert.equal(t.classe, 'nao_checado', 'classe compatível com os apps'); assert.equal(t.veredito, 'suspeito'); assert.ok(t.motivo);
  const m = json.ofertas.find((o) => o.nome.startsWith('Mouse'));
  assert.equal(m.classe, 'falso'); assert.equal(m.lojaRef, 'Americanas');
});

test('anúncio típico por loja: só com 10+ ofertas com "de"', () => {
  const muitas = Array.from({ length: 20 }, (_, i) => ({ loja: 'KaBuM!', preco: 100, de: 100 / (1 - (0.2 + i * 0.02)) }));
  const m = anuncioPorLoja(muitas.concat([{ loja: 'Pequena', preco: 50, de: 100 }]));
  assert.ok(m.get('kabum!').anunciadoComumLoja > 0.3 && m.get('kabum!').anunciadoComumLoja < 0.5);
  assert.ok(m.get('kabum!').anunciadoP90Loja >= m.get('kabum!').anunciadoComumLoja);
  assert.equal(m.get('pequena'), undefined);
});
