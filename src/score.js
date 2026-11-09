// Score de segurança 0–100: "dá para comprar aqui sem cair em golpe?"
// Não mede se o preço é bom (isso é o desconto real). Mede o risco da LOJA e da OFERTA.

// Varejistas e marketplaces grandes (domínio raiz). Comprar no domínio verdadeiro deles é seguro.
export const DOMINIOS_CONFIAVEIS = new Map([
  ['mercadolivre.com.br', 'Mercado Livre'], ['amazon.com.br', 'Amazon'], ['magazineluiza.com.br', 'Magalu'],
  ['magalu.com', 'Magalu'], ['casasbahia.com.br', 'Casas Bahia'], ['pontofrio.com.br', 'Ponto'], ['extra.com.br', 'Extra'],
  ['americanas.com.br', 'Americanas'], ['submarino.com.br', 'Submarino'], ['shoptime.com.br', 'Shoptime'],
  ['kabum.com.br', 'KaBuM!'], ['shopee.com.br', 'Shopee'], ['aliexpress.com', 'AliExpress'], ['pt.aliexpress.com', 'AliExpress'],
  ['carrefour.com.br', 'Carrefour'], ['fastshop.com.br', 'Fast Shop'], ['leroymerlin.com.br', 'Leroy Merlin'],
  ['centauro.com.br', 'Centauro'], ['netshoes.com.br', 'Netshoes'], ['samsung.com', 'Samsung'], ['apple.com', 'Apple'],
  ['dell.com', 'Dell'], ['lenovo.com', 'Lenovo'], ['motorola.com.br', 'Motorola'], ['lg.com', 'LG'],
  ['electrolux.com.br', 'Electrolux'], ['brastemp.com.br', 'Brastemp'], ['consul.com.br', 'Consul'],
  ['tiktok.com', 'TikTok Shop'], ['temu.com', 'Temu'], ['shein.com', 'Shein'], ['br.shein.com', 'Shein'],
  // lojas oficiais validadas pelo robô educado em 08/11/2026 (fora da lista = score 50 e fora da vitrine)
  ['decathlon.com.br', 'Decathlon'], ['lojasrenner.com.br', 'Renner'], ['rihappy.com.br', 'Ri Happy'], ['cobasi.com.br', 'Cobasi'],
  ['tokstok.com.br', 'Tok&Stok'], ['polishop.com.br', 'Polishop'], ['riachuelo.com.br', 'Riachuelo'], ['cea.com.br', 'C&A'],
  ['petz.com.br', 'Petz'], ['drogasil.com.br', 'Drogasil'], ['drogaraia.com.br', 'Droga Raia'], ['natura.com.br', 'Natura'],
  ['nike.com.br', 'Nike'], ['havan.com.br', 'Havan'], ['kalunga.com.br', 'Kalunga'], ['madeiramadeira.com.br', 'MadeiraMadeira']
]);
const MARKETPLACES = new Set(['Mercado Livre', 'Amazon', 'Magalu', 'Casas Bahia', 'Americanas', 'Shopee', 'AliExpress', 'Carrefour', 'KaBuM!', 'TikTok Shop', 'Temu', 'Shein']);
const NOMES_ALVO = ['mercadolivre', 'mercadolibre', 'amazon', 'magazineluiza', 'magalu', 'casasbahia', 'americanas', 'kabum', 'shopee', 'aliexpress', 'pontofrio', 'carrefour', 'fastshop', 'samsung', 'apple'];
const TLD_SUSPEITOS = new Set(['shop', 'xyz', 'online', 'top', 'store', 'site', 'click', 'vip', 'icu', 'buzz', 'fun', 'live', 'sbs', 'cfd', 'cyou', 'lat']);

export const PESOS = {
  base: { oficial: 95, reputacaoAlta: 88, reputacaoMedia: 72, vendedorNovo: 55, reputacaoBaixa: 40, independente: 60 },
  precoBomDemais: 35,      // ≥ 60% abaixo do mercado
  precoMuitoBaixo: 15,     // ≥ 45% abaixo do mercado
  dominioMenos30: 40,
  dominioMenos180: 20,
  dominioMenos1ano: 10,
  dominioIdadeDesconhecida: 10,
  imitaMarca: 45,
  tldSuspeito: 10,
  semHttps: 30,
  soPix: 25,
  semCnpj: 10
};

export const FAIXAS = [
  { min: 80, id: 'seguro', nome: 'Seguro' },
  { min: 60, id: 'atencao', nome: 'Atenção' },
  { min: 40, id: 'cuidado', nome: 'Cuidado' },
  { min: 0, id: 'evite', nome: 'Evite' }
];

function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Lê a URL e devolve o que dá para saber sem rede. */
export function analisarUrl(url) {
  let u;
  try { u = new URL(url); } catch { return { valida: false }; }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  let confiavel = null;
  for (const [dom, nome] of DOMINIOS_CONFIAVEIS) if (host === dom || host.endsWith('.' + dom)) { confiavel = nome; break; }
  const partes = host.split('.');
  const tld = partes[partes.length - 1];
  const raiz = (partes.length > 2 && partes[partes.length - 2].length <= 3 ? partes[partes.length - 3] : partes[partes.length - 2]) || host;
  const semHifen = host.replace(/[-.]/g, '');
  let imita = null;
  if (!confiavel) {
    for (const alvo of NOMES_ALVO) {
      if (semHifen.includes(alvo) || (raiz.length >= 5 && levenshtein(raiz, alvo) <= 2)) { imita = alvo; break; }
    }
  }
  return {
    valida: true, host, tld, https: u.protocol === 'https:',
    loja: confiavel, marketplace: confiavel ? MARKETPLACES.has(confiavel) : false,
    imitaMarca: imita, tldSuspeito: TLD_SUSPEITOS.has(tld)
  };
}

/**
 * @param {object} s sinais (todos opcionais; o que faltar não pesa, exceto onde dito)
 * @param {string} [s.url]
 * @param {boolean} [s.lojaOficial]       loja oficial da marca / vendido e entregue pela própria varejista
 * @param {'alta'|'media'|'baixa'|'nova'} [s.reputacao]  reputação do vendedor no marketplace
 * @param {number} [s.idadeDominioDias]   só pesa em site fora da lista de confiáveis
 * @param {boolean} [s.soPix]
 * @param {boolean} [s.temCnpj]           CNPJ visível e ativo (só pesa em site independente)
 * @param {number} [s.realVsMercado]      1 - preço/mercado hoje (preço bom demais)
 */
export function scoreSeguranca(s = {}) {
  const url = s.url ? analisarUrl(s.url) : { valida: false };
  const motivos = [];
  const independente = !url.loja;
  let pontos;

  if (!independente && s.lojaOficial) { pontos = PESOS.base.oficial; motivos.push(`loja oficial em ${url.loja}`); }
  else if (!independente && url.marketplace) {
    const r = s.reputacao;
    pontos = r === 'alta' ? PESOS.base.reputacaoAlta : r === 'media' ? PESOS.base.reputacaoMedia
      : r === 'baixa' ? PESOS.base.reputacaoBaixa : r === 'nova' ? PESOS.base.vendedorNovo : PESOS.base.reputacaoMedia;
    motivos.push(`${url.loja}, vendedor com reputação ${r || 'não informada'}`);
  } else if (!independente) { pontos = PESOS.base.oficial; motivos.push(`site oficial ${url.loja}`); }
  else { pontos = PESOS.base.independente; motivos.push('site fora dos grandes varejistas'); }

  const tira = (n, m) => { pontos -= n; motivos.push(`-${n} ${m}`); };

  if (url.valida && !url.https) tira(PESOS.semHttps, 'sem cadeado (http)');
  if (url.imitaMarca) tira(PESOS.imitaMarca, `endereço imita "${url.imitaMarca}"`);
  if (independente && url.tldSuspeito) tira(PESOS.tldSuspeito, `final .${url.tld}`);
  if (independente) {
    const d = s.idadeDominioDias;
    if (d == null) tira(PESOS.dominioIdadeDesconhecida, 'idade do site desconhecida');
    else if (d < 30) tira(PESOS.dominioMenos30, `site criado há ${d} dias`);
    else if (d < 180) tira(PESOS.dominioMenos180, `site criado há ${d} dias`);
    else if (d < 365) tira(PESOS.dominioMenos1ano, 'site com menos de 1 ano');
    if (s.temCnpj === false) tira(PESOS.semCnpj, 'sem CNPJ visível');
  }
  if (s.soPix) tira(PESOS.soPix, 'só aceita Pix');
  if (s.realVsMercado >= 0.60) tira(PESOS.precoBomDemais, `${Math.round(s.realVsMercado * 100)}% abaixo do mercado: bom demais`);
  else if (s.realVsMercado >= 0.45) tira(PESOS.precoMuitoBaixo, `${Math.round(s.realVsMercado * 100)}% abaixo do mercado`);

  // Travas: certos sinais sozinhos já tornam a compra arriscada, não importa o resto.
  if (url.imitaMarca) pontos = Math.min(pontos, 15);
  if (independente && s.idadeDominioDias != null && s.idadeDominioDias < 30) pontos = Math.min(pontos, 25);
  if (independente && s.soPix) pontos = Math.min(pontos, 35);

  const score = Math.max(0, Math.min(100, Math.round(pontos)));
  const faixa = FAIXAS.find((f) => score >= f.min);
  return { score, faixa: faixa.id, faixaNome: faixa.nome, motivos };
}
