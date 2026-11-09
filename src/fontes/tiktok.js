// TikTok Shop — Affiliate API (Partner Center, versão 202309+): busca de produtos em "colaboração aberta"
// por categoria, faixa de comissão e palavra; geração de link de afiliado.
// ESTADO: NÃO VALIDADO. Exige conta de afiliado elegível (1.000+ seguidores) OU app de desenvolvedor aprovado,
// com app_key/app_secret e access_token do criador. A assinatura (HMAC-SHA256 dos parâmetros + caminho + corpo)
// segue a doc do Partner Center; conferir lá antes de ligar.

import { createHmac } from 'node:crypto';

export const precisa = ['TIKTOK_APP_KEY', 'TIKTOK_APP_SECRET', 'TIKTOK_ACCESS_TOKEN'];
const API = 'https://open-api.tiktokglobalshop.com';

export function assinar(caminho, params, corpo, secret) {
  const chaves = Object.keys(params).filter((k) => k !== 'sign' && k !== 'access_token').sort();
  const base = secret + caminho + chaves.map((k) => k + params[k]).join('') + (corpo || '') + secret;
  return createHmac('sha256', secret).update(base).digest('hex');
}

export async function coletar({ termos = [], categoriasTikTok = [], cat = 'outros', limite = 100 } = {}) {
  const app = process.env.TIKTOK_APP_KEY, secret = process.env.TIKTOK_APP_SECRET, token = process.env.TIKTOK_ACCESS_TOKEN;
  const caminho = '/affiliate_creator/202405/open_collaborations/products/search';
  const saida = [];
  for (const termo of termos.length ? termos : ['']) {
    const params = { app_key: app, timestamp: String(Math.floor(Date.now() / 1000)), page_size: String(Math.min(limite, 100)) };
    const corpo = JSON.stringify({ keyword: termo || undefined, category_ids: categoriasTikTok.length ? categoriasTikTok : undefined });
    params.sign = assinar(caminho, params, corpo, secret);
    const q = new URLSearchParams(params).toString();
    const r = await fetch(`${API}${caminho}?${q}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-tts-access-token': token }, body: corpo });
    if (!r.ok) { console.warn(`TikTok "${termo}": HTTP ${r.status}`); continue; }
    const j = await r.json();
    for (const p of j?.data?.products || []) {
      const preco = Number(p.price?.sale_price_amount ?? p.price?.amount), de = Number(p.price?.original_price_amount) || null;
      if (!(preco > 0)) continue;
      saida.push({
        fonte: 'tiktok', loja: 'TikTok Shop', titulo: p.title, cat, catLoja: p.category_name ?? null, preco, de: de > preco ? de : null,
        url: p.product_detail_url || `https://www.tiktok.com/shop/pdp/${p.id}`, img: p.main_image_url ?? null,
        vendedor: { oficial: !!p.shop?.is_official, reputacao: null, nome: p.shop?.name ?? null }, comissao: p.commission_rate ?? null
      });
    }
  }
  return saida;
}
