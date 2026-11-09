// Shopee Affiliate Open API (GraphQL). Precisa de AppID e Secret aprovados no painel de afiliados.
// ESTADO: NÃO VALIDADO (sem credencial). Formato da assinatura e campos conforme docs de terceiros;
// conferir na documentação oficial do painel antes de ligar.
import { createHash } from 'node:crypto';

export const precisa = ['SHOPEE_APP_ID', 'SHOPEE_SECRET'];
const URL_API = 'https://open-api.affiliate.shopee.com.br/graphql';

export function assinatura(appId, secret, ts, payload) {
  return createHash('sha256').update(appId + ts + payload + secret).digest('hex');
}

export async function coletar({ termos = [], cat = 'outros', limite = 50 }) {
  const appId = process.env.SHOPEE_APP_ID, secret = process.env.SHOPEE_SECRET;
  const saida = [];
  for (const termo of termos) {
    const query = `{ productOfferV2(keyword: ${JSON.stringify(termo)}, sortType: 2, page: 1, limit: ${limite}) {
      nodes { itemId productName price priceMin priceDiscountRate imageUrl offerLink productLink shopName shopType ratingStar sales }
    } }`;
    const payload = JSON.stringify({ query });
    const ts = Math.floor(Date.now() / 1000);
    const r = await fetch(URL_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${assinatura(appId, secret, ts, payload)}` },
      body: payload
    });
    if (!r.ok) { console.warn(`Shopee "${termo}": HTTP ${r.status}`); continue; }
    const j = await r.json();
    for (const n of j?.data?.productOfferV2?.nodes || []) {
      const preco = Number(n.priceMin ?? n.price), taxa = Number(n.priceDiscountRate) || 0;
      saida.push({
        fonte: 'shopee', loja: 'Shopee', titulo: n.productName, cat, preco,
        de: taxa > 0 ? Math.round((preco / (1 - taxa / 100)) * 100) / 100 : null,
        url: n.offerLink || n.productLink, img: n.imageUrl,
        // shopType: Mall/oficial e Preferred contam como reputação alta (a confirmar os códigos)
        vendedor: { oficial: [1].includes(Number(n.shopType)), reputacao: Number(n.ratingStar) >= 4.7 ? 'alta' : Number(n.ratingStar) >= 4.3 ? 'media' : 'baixa' }
      });
    }
  }
  return saida;
}
