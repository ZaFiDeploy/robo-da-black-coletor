// Lomadee (rede de afiliados): API de ofertas por categoria/loja.
// ESTADO: NÃO VALIDADO. A documentação oficial é antiga (developer.lomadee.com); bibliotecas de terceiros usam
//   GET https://api.lomadee.com/v3/{APP_TOKEN}/offer/_category/{categoryId}?sourceId={SOURCE_ID}&size=100&page=N
// Quando o Milton criar a conta (grátis) e pegar app token + source id, testar e ajustar os campos.

export const precisa = ['LOMADEE_APP_TOKEN', 'LOMADEE_SOURCE_ID'];
const API = 'https://api.lomadee.com/v3';
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export async function coletar({ categorias = [], paginas = 3, cat = 'outros', intervaloMs = 700 } = {}) {
  const token = process.env.LOMADEE_APP_TOKEN, source = process.env.LOMADEE_SOURCE_ID;
  const saida = [];
  for (const categoria of categorias) {
    for (let page = 1; page <= paginas; page++) {
      const r = await fetch(`${API}/${token}/offer/_category/${categoria}?sourceId=${source}&size=100&page=${page}`, { headers: { accept: 'application/json' } });
      if (!r.ok) { console.warn(`Lomadee cat ${categoria} p${page}: HTTP ${r.status}`); break; }
      const j = await r.json();
      const lista = j.offers || [];
      for (const o of lista) {
        const preco = Number(o.price), de = Number(o.priceFrom) || null;
        if (!(preco > 0)) continue;
        saida.push({
          fonte: 'lomadee', loja: o.store?.name || 'Lomadee', titulo: o.name, cat, catLoja: o.category?.name ?? null,
          preco, de: de > preco ? de : null, url: o.link, img: o.thumbnail ?? null, vendedor: { oficial: true, reputacao: null }
        });
      }
      if (lista.length < 100) break;
      await pausa(intervaloMs);
    }
  }
  return saida;
}
