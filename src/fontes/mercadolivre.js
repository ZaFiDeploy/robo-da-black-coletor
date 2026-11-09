// Mercado Livre pela API oficial (app de desenvolvedor, token client_credentials).
// ESTADO: NÃO VALIDADO. Em 07/11/2026, sem token:
//   /sites/MLB/search  -> 403 forbidden
//   /products/search   -> 403 PolicyAgent
//   /products/{id}     -> 401 "authorization value not present"  (pede token: é o que vamos testar)
// Quando o Milton criar o app em developers.mercadolivre.com.br, rodar:
//   ML_CLIENT_ID=... ML_CLIENT_SECRET=... node src/coletor.js --fonte mercadolivre --entrada alvos/ml-produtos.txt
// alvos/ml-produtos.txt = um ID de catálogo por linha (ex.: MLB24047848), escolhidos por categoria.

import { readFile } from 'node:fs/promises';

export const precisa = ['ML_CLIENT_ID', 'ML_CLIENT_SECRET'];
const API = 'https://api.mercadolibre.com';
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function token() {
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.ML_CLIENT_ID, client_secret: process.env.ML_CLIENT_SECRET })
  });
  if (!r.ok) throw new Error(`ML token: HTTP ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

export async function coletar({ entrada, cat = 'outros', intervaloMs = 400 }) {
  const ids = (await readFile(entrada, 'utf8')).split(/\s+/).filter((x) => /^MLB\d+$/.test(x));
  const tk = await token();
  const saida = [];
  for (const id of ids) {
    const r = await fetch(`${API}/products/${id}`, { headers: { authorization: `Bearer ${tk}` } });
    if (!r.ok) { console.warn(`ML ${id}: HTTP ${r.status}`); await pausa(intervaloMs); continue; }
    const p = await r.json();
    const bb = p.buy_box_winner;
    if (!bb?.price) { await pausa(intervaloMs); continue; }
    const gtin = (p.attributes || []).find((a) => a.id === 'GTIN')?.value_name;
    const marca = (p.attributes || []).find((a) => a.id === 'BRAND')?.value_name;
    const modelo = (p.attributes || []).find((a) => a.id === 'MODEL')?.value_name;
    saida.push({
      fonte: 'mercadolivre', loja: 'Mercado Livre', titulo: p.name, ean: gtin, marca, modelo, cat,
      preco: bb.price, de: bb.original_price ?? null, url: p.permalink || `https://www.mercadolivre.com.br/p/${id}`,
      img: p.pictures?.[0]?.url ?? null,
      vendedor: { oficial: !!bb.official_store_id, reputacao: null, id: bb.seller_id } // reputação: /users/{id} (a validar)
    });
    await pausa(intervaloMs); // leve: ~2 por segundo
  }
  return saida;
}
