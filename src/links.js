// Link colado pela pessoa → loja + id do produto naquela loja.
// É a porta de entrada do "compare o preço do produto que VOCÊ quer": o link vira um item vigiado.
// Não abre a página (sem rede). Link encurtado volta como 'encurtado' para o coletor seguir o redirecionamento.

const ENCURTADORES = /^(amzn\.to|a\.co|s\.shopee\.com\.br|shope\.ee|mercadolivre\.com\/sec|meli\.la|tinyurl\.com|bit\.ly)/;

export const LOJAS_MONITORADAS = [
  [/(^|\.)americanas\.com\.br$/, 'americanas'], [/(^|\.)carrefour\.com\.br$/, 'carrefour'], [/(^|\.)rihappy\.com\.br$/, 'rihappy'],
  [/(^|\.)cobasi\.com\.br$/, 'cobasi'], [/(^|\.)decathlon\.com\.br$/, 'decathlon'], [/(^|\.)lojasrenner\.com\.br$/, 'lojasrenner'],
  [/(^|\.)polishop\.com\.br$/, 'polishop'], [/(^|\.)tokstok\.com\.br$/, 'tokstok']
];

export function idDoLink(texto) {
  const bruto = String(texto ?? '').trim().match(/https?:\/\/\S+/)?.[0] ?? String(texto ?? '').trim();
  let u;
  try { u = new URL(/^https?:/.test(bruto) ? bruto : 'https://' + bruto); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null; // "oi", "abc": não é endereço de site
  const caminho = decodeURIComponent(u.pathname);
  const r = (loja, id, tipo) => ({ loja, id, tipo, chave: `${loja}:${id}`, url: u.origin + u.pathname });

  if (ENCURTADORES.test(host + caminho)) return { loja: null, id: null, tipo: 'encurtado', chave: null, url: u.href };

  if (/(^|\.)mercadolivre\.com\.br$/.test(host)) {
    let m = caminho.match(/\/p\/(MLB\d+)/i);
    if (m) return r('mercadolivre', m[1].toUpperCase(), 'catalogo');
    m = caminho.match(/\/up\/(MLBU\d+)/i);
    if (m) return r('mercadolivre', m[1].toUpperCase(), 'up');
    m = (caminho + ' ' + u.hash).match(/MLB-?(\d{6,})/i);
    if (m) return r('mercadolivre', 'MLB' + m[1], 'anuncio');
    return null;
  }
  if (/(^|\.)amazon\.com\.br$/.test(host)) {
    const m = caminho.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
    return m ? r('amazon', m[1].toUpperCase(), 'asin') : null;
  }
  if (/(^|\.)shopee\.com\.br$/.test(host)) {
    let m = caminho.match(/-i\.(\d+)\.(\d+)/);
    if (!m) m = caminho.match(/\/product\/(\d+)\/(\d+)/);
    return m ? r('shopee', `${m[1]}.${m[2]}`, 'item') : null;
  }
  if (/(^|\.)kabum\.com\.br$/.test(host)) {
    const m = caminho.match(/\/produto\/(\d+)/);
    return m ? r('kabum', m[1], 'produto') : null;
  }
  if (/(^|\.)(magazineluiza\.com\.br|magalu\.com)$/.test(host)) {
    const m = caminho.match(/\/p\/([a-z0-9]{6,})\/?/i);
    return m ? r('magalu', m[1].toLowerCase(), 'produto') : null;
  }
  if (/(^|\.)americanas\.com\.br$/.test(host)) {
    const m = caminho.match(/\/produto\/(\d+)/);
    if (m) return r('americanas', m[1], 'produto');
  }
  // Lojas que o robô educado monitora (VTEX e parecidas): o id é o caminho da página do produto (".../nome-do-produto/p").
  for (const [re, loja] of LOJAS_MONITORADAS) {
    if (!re.test(host)) continue;
    const m = caminho.match(/^\/(.+?)\/p\/?$/i) || caminho.match(/^\/(.+?)\/?$/);
    return m ? r(loja, m[1].toLowerCase(), 'produto') : null;
  }
  return { loja: 'outra', id: host + caminho, tipo: 'site', chave: `outra:${host}${caminho}`, url: u.origin + u.pathname };
}
