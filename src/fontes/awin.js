// Awin: feeds de produtos (CSV) dos anunciantes aprovados (KaBuM! e outros varejistas que estiverem na rede).
// ESTADO: NÃO VALIDADO (sem conta). Precisa do Publisher ID e da "data feed key" (não é a API key).
// Lista de feeds: https://productdata.awin.com/datafeed/list/apikey/{AWIN_FEED_KEY}  (CSV com link de cada feed)
// As colunas do feed são escolhidas no "Create-a-Feed"; o mapa abaixo usa os nomes padrão da Awin.

export const precisa = ['AWIN_FEED_KEY'];

/** CSV simples com aspas. Para feeds grandes, trocar por leitura em stream. */
export function lerCsv(texto) {
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cab, ...resto] = linhas;
  return resto.filter((l) => l.length > 1).map((l) => Object.fromEntries(cab.map((k, i) => [k.trim(), l[i]])));
}

export function linhaParaOferta(l, cat = 'outros') {
  const preco = parseFloat(l.search_price || l.store_price);
  const de = parseFloat(l.rrp_price || l.product_price_old) || null;
  return {
    fonte: 'awin', loja: l.merchant_name, titulo: l.product_name, ean: l.ean || l.product_GTIN || null,
    marca: l.brand_name || null, modelo: l.model_number || null, cat, preco, de: de > preco ? de : null,
    url: l.aw_deep_link, img: l.merchant_image_url || l.aw_image_url || null, vendedor: { oficial: true }
  };
}

export async function coletar({ anunciantes = [], cat = 'outros' }) {
  const lista = lerCsv(await (await fetch(`https://productdata.awin.com/datafeed/list/apikey/${process.env.AWIN_FEED_KEY}`)).text());
  const saida = [];
  for (const f of lista.filter((f) => !anunciantes.length || anunciantes.includes(f['Advertiser Name']))) {
    const url = f.URL || f.url;
    if (!url) continue;
    const r = await fetch(url);
    if (!r.ok) { console.warn(`Awin ${f['Advertiser Name']}: HTTP ${r.status}`); continue; }
    for (const l of lerCsv(await r.text())) saida.push(linhaParaOferta(l, cat));
  }
  return saida;
}
