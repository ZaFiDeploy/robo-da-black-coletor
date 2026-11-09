// Fonte "sitemap educada": lojas que PERMITEM robôs no robots.txt e publicam sitemap de produtos.
// Regras (não negociáveis):
//   - lê o robots.txt antes e só pede caminhos permitidos para "*" ou para o nosso nome;
//   - identidade honesta (UA do robots.js), 1 pedido a cada PAUSA_MS (ou o Crawl-delay do site, se maior);
//   - usa o sitemap, nunca a busca da loja; lê só o JSON-LD público (preço, EAN, marca, foto);
//   - PARA NA HORA ao primeiro 403/429/captcha e não tenta de novo nesta rodada.
// Lojas: ver LOJAS abaixo. Validado em 07/11/2026 só o KaBuM! (robots permite /produto/, JSON-LD com preço).

import { UA, robotsDe, permitido, grupoPara } from '../robots.js';
import { produtoDoJsonLd, categoriasDoJsonLd } from '../jsonld.js';

export const precisa = []; // sem chave

export const LOJAS = {
  kabum: {
    nome: 'KaBuM!', origem: 'https://www.kabum.com.br', sitemapIndex: 'https://www.kabum.com.br/sitemap.xml',
    produto: /\/produto\/\d+/, oficial: true,
    // o "de" e o vendedor do KaBuM! estão no JSON da página (público), não no JSON-LD
    extra(html) {
      const m = html.match(/"prices":\{"oldPrice":([\d.]+),"priceWithDiscount":([\d.]+),"price":([\d.]+),"discountPercentage":([\d.]+)\}/);
      const v = html.match(/"sellerName":"([^"]*)"/);
      const cat = html.match(/"category":"([^"]*)"/);
      return { de: m && +m[1] > 0 ? +m[1] : null, vendedor: v ? v[1] : null, categoria: cat ? cat[1] : null };
    }
  },
  // Americanas e Carrefour (VTEX): sitemap.xml lista milhares de sitemap/product-N.xml com 1 produto cada (2 pedidos por produto).
  // JSON-LD com gtin (Americanas) e preço; produto sem estoque vem com price 0 e é descartado. Validado com 1 página cada em 07/11/2026.
  americanas: { nome: 'Americanas', origem: 'https://www.americanas.com.br', sitemapIndex: 'https://www.americanas.com.br/sitemap.xml', subsitemap: /\/sitemap\/product-\d+\.xml$/, produto: /\/p$/, oficial: true, extra: dePorChave(['listPrice']) },
  carrefour: { nome: 'Carrefour', origem: 'https://www.carrefour.com.br', sitemapIndex: 'https://www.carrefour.com.br/sitemap.xml', subsitemap: /\/sitemap\/product-\d+\.xml$/, produto: /\/p$/, oficial: true },
  // Lojas sondadas em 08/11/2026 (robots 200, sitemap de produto legível, página 200 com JSON-LD e preço).
  // O "de" dessas lojas NÃO vem no JSON-LD: está no JSON da página (listPrice / oldPrice), conferido 1 página por loja em 08/11.
  ...vtex('cobasi', 'Cobasi', 'www.cobasi.com.br', { escala: 100 }),      // listPrice em centavos (4490 = R$ 44,90)
  ...vtex('tokstok', 'Tok&Stok', 'www.tokstok.com.br'),                    // oldPrice
  ...vtex('polishop', 'Polishop', 'www.polishop.com.br'),                  // listPrice
  ...vtex('rihappy', 'Ri Happy', 'www.rihappy.com.br'),                    // listPrice (escapado dentro de string)
  ...vtex('decathlon', 'Decathlon', 'www.decathlon.com.br'),               // JSON-LD ProductGroup (variantes); "de" já vem no JSON-LD
  lojasrenner: { nome: 'Renner', origem: 'https://www.lojasrenner.com.br', sitemapIndex: 'https://www.lojasrenner.com.br/sitemap.xml', subsitemap: /\/detail\d+\.xml$/, produto: /\/p\//, oficial: true, sondada: '2026-11-08', extra: dePorChave(['listPrice']) }
  // Sondadas e DESCARTADAS em 08/11/2026 (não insistir): robots.txt 403 ao robô honesto → Ponto, Extra, Centauro, Riachuelo, Petz,
  // Drogasil, Droga Raia, Panvel, Natura, Nike, Terabyte, Leroy Merlin, Casas Bahia, Magalu, Netshoes; página 403 → Pichau;
  // sitemap 503 → Fast Shop; sem sitemap de produto legível → C&A, Havan, MadeiraMadeira, Mobly, Dafiti, Zattini, Shoptime, Kalunga.
};

/** Config padrão de loja VTEX: sitemap.xml → sitemap/product-N.xml (ou qualquer .xml com "product") → URLs terminadas em /p. */
function vtex(id, nome, host, { escala = 1 } = {}) {
  return { [id]: { nome, origem: 'https://' + host, sitemapIndex: 'https://' + host + '/sitemap.xml', subsitemap: /product|produto/i, produto: /\/p(\/|$)|\/produto\//, oficial: true, sondada: '2026-11-08', extra: dePorChave(['listPrice', 'ListPrice', 'oldPrice'], escala) } };
}

/** Lê o preço "de" do JSON embutido na página: a 1ª ocorrência de "chave":123.45 (aceita aspas escapadas \" e valor em string). */
export function dePorChave(chaves, escala = 1) {
  return (html) => {
    for (const k of chaves) {
      const m = html.match(new RegExp('\\\\*"' + k + '\\\\*":\\s*\\\\*"?(\\d+(?:\\.\\d+)?)'));
      if (m) return { de: +m[1] / escala };
    }
    return {};
  };
}

/** Só conta como "de" o que está pelo menos 5% acima do preço (abaixo disso é diferença de Pix/boleto) e até 4× (acima é erro de leitura). */
export const DE_MIN = 1.05;
export function deValido(de, preco) {
  return de && preco && de >= preco * DE_MIN && de <= preco * 4 ? de : null;
}

export const PAUSA_MS = 1500;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const BLOQUEIO = /captcha|challenge|access denied|radware|cloudflare|verifica[çc][ãa]o/i;

function locs(xml) { return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]); }

export class Bloqueado extends Error { constructor(loja, status, url) { super(`${loja}: bloqueado (${status}) em ${url}. Parando.`); this.status = status; } }

/**
 * @param {object} p
 * @param {string} [p.loja='kabum']
 * @param {number} [p.limite=200]        máximo de páginas de produto nesta rodada
 * @param {string[]} [p.sitemaps]        subsitemaps a usar (ex.: ['tv','hardware']); vazio = todos
 * @param {number} [p.porSitemap]        máximo de páginas por subsitemap (espalha a coleta pelas categorias)
 * @param {Function} [p.fetchFn]
 * @param {Function} [p.log]
 */
export async function coletar({ loja = 'kabum', limite = 200, sitemaps = [], porSitemap = 0, fetchFn = fetch, log = () => {}, pausaMs = PAUSA_MS } = {}) {
  const L = LOJAS[loja];
  if (!L) throw new Error(`loja desconhecida: ${loja}`);
  const cab = { 'user-agent': UA, accept: 'text/html,application/xml;q=0.9,*/*;q=0.5', 'accept-language': 'pt-BR,pt;q=0.9' };
  const pega = async (url) => {
    const r = await fetchFn(url, { headers: cab, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (r.status === 403 || r.status === 429 || r.status === 503) throw new Bloqueado(L.nome, r.status, url);
    const t = await r.text();
    const ehXml = /^\s*<\?xml|^\s*<(urlset|sitemapindex)/.test(t.slice(0, 200));
    if (r.status === 200 && !ehXml && BLOQUEIO.test(t.slice(0, 4000)) && !/application\/ld\+json/.test(t)) throw new Bloqueado(L.nome, 'captcha', url);
    return { status: r.status, texto: t, url: r.url };
  };

  // 1) robots
  const rb = await robotsDe(L.origem, fetchFn);
  if (!rb.ok) { log(`${L.nome}: robots.txt não lido (${rb.status || rb.erro}); não coleto.`); return []; }
  const g = grupoPara(rb.grupos);
  const espera = Math.max(pausaMs, ((g && g.delay) || 0) * 1000);
  const pode = (u) => permitido(rb.grupos, new URL(u).pathname + new URL(u).search);
  if (!pode(L.sitemapIndex)) { log(`${L.nome}: robots proíbe o sitemap; não coleto.`); return []; }

  // 2) sitemaps → URLs de produto (bloqueio aqui também para a rodada, sem derrubar o processo)
  await pausa(espera);
  let idx;
  try { idx = await pega(L.sitemapIndex); } catch (e) { log(e.message); return []; }
  let subs = locs(idx.texto).filter((u) => u.endsWith('.xml') && (!L.subsitemap || L.subsitemap.test(u)));
  if (!subs.length) subs = [L.sitemapIndex];
  if (sitemaps.length) subs = subs.filter((u) => sitemaps.some((s) => u.includes(s)));
  const urls = [];
  for (const s of subs) {
    if (urls.length >= limite) break;
    await pausa(espera);
    let x;
    try { x = await pega(s); } catch (e) { log(e.message); if (e instanceof Bloqueado) break; continue; }
    let desteSitemap = 0;
    for (const u of locs(x.texto)) {
      if (!L.produto.test(u) || !pode(u)) continue;
      if (porSitemap && desteSitemap >= porSitemap) break;
      urls.push(u); desteSitemap++;
      if (urls.length >= limite) break;
    }
  }
  log(`${L.nome}: ${urls.length} páginas de produto no plano (${subs.length} sitemaps), pausa ${espera} ms`);

  // 3) páginas de produto → JSON-LD
  const saida = [];
  for (const u of urls) {
    await pausa(espera);
    let pg;
    try { pg = await pega(u); } catch (e) { if (e instanceof Bloqueado) { log(e.message); break; } log(`${L.nome}: erro em ${u}: ${e.message}`); continue; }
    if (pg.status !== 200) continue;
    const p = produtoDoJsonLd(pg.texto);
    if (!p || !p.titulo || p.preco < 1) continue; // R$ 0,01 = provador/placeholder (Renner), não é oferta
    const ex = L.extra ? L.extra(pg.texto) : {};
    const cats = categoriasDoJsonLd(pg.texto);
    saida.push({
      fonte: 'sitemap-' + loja, loja: L.nome, titulo: p.titulo, ean: p.ean, marca: p.marca, modelo: p.modelo,
      cat: null, catLoja: ex.categoria || cats[0] || null, caminhoLoja: cats,
      preco: p.preco, de: deValido(p.de, p.preco) ?? deValido(ex.de, p.preco), url: pg.url || u, img: p.img,
      vendedor: { oficial: L.oficial && !(ex.vendedor && !/kabum/i.test(ex.vendedor)), nome: ex.vendedor ?? null, reputacao: null },
      disponivel: p.disponivel, coletadoEm: new Date().toISOString()
    });
  }
  log(`${L.nome}: ${saida.length} produtos lidos de ${urls.length} páginas`);
  return saida;
}
