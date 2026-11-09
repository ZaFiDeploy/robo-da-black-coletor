// Link de afiliado: todo link que sai do Robô (apps, Jackbot, canal) passa por aqui.
// Amazon: basta a tag do Associados no link (regra do programa). Shopee: o link de afiliado vem pronto
// da Open API de afiliados (campo offerLink) quando a conta for aprovada; aqui só não estraga o que já vier.
// Mercado Livre: sem programa ligado ainda → link original.
export const AFILIADO = {
  amazonTag: process.env.AMAZON_TAG || 'cacablack-20'
};

export function comAfiliado(url, cfg = AFILIADO) {
  if (!url) return url;
  let u;
  try { u = new URL(url); } catch { return url; }
  if (/(^|\.)amazon\.com\.br$/.test(u.hostname) && cfg.amazonTag) {
    // link limpo do produto + tag (o mesmo formato que o SiteStripe gera)
    const asin = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i)?.[1];
    const limpo = asin ? new URL(`https://www.amazon.com.br/dp/${asin.toUpperCase()}`) : u;
    limpo.searchParams.set('tag', cfg.amazonTag);
    return limpo.toString();
  }
  return url;
}
