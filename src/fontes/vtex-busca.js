// Busca cruzada em lojas VTEX com catálogo público (robô educado): procura o MESMO produto da nossa vitrine
// em OUTRA loja, pelo EAN ou, sem EAN, por marca + modelo (busca por texto) validada pelo normalizador.
// É a "outra consulta, em outro lugar" que dá o preço de mercado de hoje sem esperar o sitemap cruzar.
//
// Regras (as mesmas do sitemap.js):
//   - lê o robots.txt e só chama /api/catalog_system/... se o site permitir para "*" ou para o nosso nome;
//   - identidade honesta (UA do robots.js), 1 pedido a cada PAUSA_MS;
//   - PARA NA HORA ao primeiro 403/429/503 e não tenta de novo nesta rodada;
//   - só aceita casamento que o normalizador confirma (EAN igual, ou marca + modelo sem atributo em conflito)
//     e só produto disponível com preço > 0; nada de "parecido" apresentado como igual.
//
// Sondado em 08/11/2026 (1 pedido por loja): Americanas 200 (EAN e texto, com preço/ListPrice/estoque), Ri Happy 200,
// Cobasi 200; Carrefour 403 na API (fora); Tok&Stok e Decathlon 404 (não é essa API); Polishop: robots proíbe /api.

import { UA, robotsDe, permitido, grupoPara } from '../robots.js';
import { eanValido, mesmoProduto, tokens, marcaDe, modeloDe } from '../normalizar.js';

export const precisa = []; // sem chave

export const LOJAS = {
  americanas: { nome: 'Americanas', origem: 'https://www.americanas.com.br', sondada: '2026-11-08' },
  rihappy: { nome: 'Ri Happy', origem: 'https://www.rihappy.com.br', sondada: '2026-11-08' },
  cobasi: { nome: 'Cobasi', origem: 'https://www.cobasi.com.br', sondada: '2026-11-08' }
  // carrefour: API 403 ao robô honesto; tokstok/decathlon: API 404; polishop: robots proíbe /api (08/11/2026). Não insistir.
};

export const PAUSA_MS = 1500;
/** Preço da outra loja fora de 1/3 a 3× do nosso = produto diferente (acessório, kit, usado), mesmo que o texto pareça igual. */
export const RAZAO_PRECO = [1 / 3, 3];
const CAMINHO_EAN = '/api/catalog_system/pub/products/search?fq=alternateIds_Ean:';
const CAMINHO_TEXTO = '/api/catalog_system/pub/products/search/?_from=0&_to=9&ft=';

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
export class Bloqueado extends Error { constructor(loja, status, url) { super(`${loja}: bloqueado (${status}) em ${url}. Parando.`); this.status = status; } }

/** EAN com 14 dígitos (para comparar 0673419232845 com 673419232845). */
export const ean14 = (e) => String(e ?? '').replace(/\D/g, '').padStart(14, '0');

/** Termo de busca por texto: marca + modelo quando existem; senão as 5 primeiras palavras úteis do título. */
export function termoBusca(o) {
  const marca = marcaDe(o.titulo, o.marca), modelo = modeloDe(o.titulo, o.modelo);
  if (marca && modelo) return `${marca} ${modelo}`;
  const t = tokens(o.titulo).slice(0, 5);
  return t.length >= 2 ? t.join(' ') : null;
}

/** Produtos do JSON da API VTEX → candidatos (1 por SKU, com o vendedor mais barato que tem estoque). */
export function candidatosVtex(json, nomeLoja) {
  const saida = [];
  if (!Array.isArray(json)) return saida;
  for (const p of json) {
    for (const it of p.items || []) {
      let melhor = null;
      for (const s of it.sellers || []) {
        const co = s.commertialOffer || {};
        if (!(co.Price > 0) || !(co.AvailableQuantity > 0)) continue;
        if (!melhor || co.Price < melhor.preco) melhor = { preco: co.Price, de: co.ListPrice > co.Price ? co.ListPrice : null, vendedor: s.sellerName || null };
      }
      if (!melhor) continue;
      const nomeSku = it.nameComplete || [p.productName, it.name].filter((x, i, a) => x && a.indexOf(x) === i).join(' ');
      saida.push({
        loja: nomeLoja, titulo: nomeSku || p.productName, ean: eanValido(it.ean) ? it.ean : null, marca: p.brand && !/n[ãa]o dispon/i.test(p.brand) ? p.brand : null,
        modelo: it.referenceId?.[0]?.Value || p.productReference || null,
        preco: melhor.preco, de: melhor.de, vendedor: melhor.vendedor, url: p.link || null, img: it.images?.[0]?.imageUrl || null, disponivel: true
      });
    }
  }
  return saida;
}

/**
 * Escolhe, entre os candidatos, o que é o MESMO produto que `o`. Devolve { outra, por } ou null.
 * EAN: só EAN igual. Texto: marca igual (quando as duas informam), sem atributo em conflito, mesmo modelo ou título
 * muito parecido (normalizador), e preço dentro de RAZAO_PRECO. Com vários, fica o mais barato.
 */
export function casar(o, candidatos) {
  const temEan = eanValido(o.ean);
  const iguais = [];
  for (const c of candidatos) {
    if (!(c.preco > 0)) continue;
    const razao = c.preco / o.preco;
    if (razao < RAZAO_PRECO[0] || razao > RAZAO_PRECO[1]) continue;
    if (temEan) { if (c.ean && ean14(c.ean) === ean14(o.ean)) iguais.push({ c, por: 'ean' }); continue; }
    const m = mesmoProduto(o, c, { limiarTitulo: 0.7 });
    if (m.mesmo && (m.por === 'modelo' || m.por === 'titulo' || m.por === 'ean')) iguais.push({ c, por: m.por });
  }
  if (!iguais.length) return null;
  iguais.sort((a, b) => a.c.preco - b.c.preco);
  return { outra: iguais[0].c, por: iguais[0].por, candidatos: iguais.length };
}

/**
 * @param {object} p
 * @param {string} p.loja              id em LOJAS (onde procurar)
 * @param {Array}  p.ofertas           nossas ofertas (de outras lojas) para procurar lá
 * @param {number} [p.limite=400]      máximo de pedidos nesta rodada
 * @param {Function} [p.fetchFn]
 * @param {Function} [p.log]
 * @param {Function} [p.aoAchar]       callback(resultado) a cada casamento (para gravar aos poucos)
 * @returns {Promise<Array<{url, chave, por, outra}>>}  um item por oferta nossa que achou par
 */
export async function cruzar({ loja, ofertas, limite = 400, fetchFn = fetch, log = () => {}, pausaMs = PAUSA_MS, aoAchar = () => {} } = {}) {
  const L = LOJAS[loja];
  if (!L) throw new Error(`loja desconhecida para busca cruzada: ${loja}`);
  const rb = await robotsDe(L.origem, fetchFn);
  if (!rb.ok) { log(`${L.nome}: robots.txt não lido (${rb.status || rb.erro}); não busco.`); return []; }
  const g = grupoPara(rb.grupos);
  const espera = Math.max(pausaMs, ((g && g.delay) || 0) * 1000);
  const pode = (caminho) => permitido(rb.grupos, caminho);
  if (!pode(CAMINHO_EAN + '0') || !pode(CAMINHO_TEXTO + 'x')) { log(`${L.nome}: robots proíbe a API de catálogo; não busco.`); return []; }

  const cab = { 'user-agent': UA, accept: 'application/json' };
  const achados = [];
  let pedidos = 0, semTermo = 0, vazios = 0;
  for (const o of ofertas) {
    if (pedidos >= limite) break;
    if (String(o.loja).toLowerCase() === L.nome.toLowerCase()) continue;
    let caminho;
    if (eanValido(o.ean)) caminho = CAMINHO_EAN + String(o.ean).replace(/\D/g, '');
    else { const t = termoBusca(o); if (!t) { semTermo++; continue; } caminho = CAMINHO_TEXTO + encodeURIComponent(t); }
    await pausa(espera);
    pedidos++;
    let r, texto;
    try {
      r = await fetchFn(L.origem + caminho, { headers: cab, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (r.status === 403 || r.status === 429 || r.status === 503) { log(new Bloqueado(L.nome, r.status, caminho).message); break; }
      texto = await r.text();
    } catch (e) { log(`${L.nome}: erro em ${caminho.slice(0, 80)}: ${e.message}`); continue; }
    if (r.status !== 200 && r.status !== 206) continue;
    let json; try { json = JSON.parse(texto); } catch { continue; }
    const cands = candidatosVtex(json, L.nome);
    if (!cands.length) { vazios++; continue; }
    const par = casar(o, cands);
    if (!par) continue;
    const item = { url: o.url, loja: o.loja, titulo: o.titulo, preco: o.preco, de: o.de ?? null, ean: o.ean ?? null, por: par.por, candidatos: par.candidatos, outra: { ...par.outra, coletadoEm: new Date().toISOString() } };
    achados.push(item); aoAchar(item);
    if (achados.length % 10 === 0) log(`${L.nome}: ${achados.length} pares em ${pedidos} pedidos`);
  }
  log(`${L.nome}: ${pedidos} pedidos, ${achados.length} pares (${achados.filter((a) => a.por === 'ean').length} por EAN), ${vazios} sem resultado, ${semTermo} sem termo, pausa ${espera} ms`);
  return achados;
}
