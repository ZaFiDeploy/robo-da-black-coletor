// impact.com (ex-Rakuten Advertising no Brasil: AliExpress, Riachuelo, Netshoes…): catálogo de produtos por anunciante.
// ESTADO: NÃO VALIDADO (sem conta). API de publisher (Media Partner) com Basic auth (Account SID + Auth Token):
//   GET https://api.impact.com/Mediapartners/{SID}/Catalogs            → lista de catálogos aprovados
//   GET https://api.impact.com/Mediapartners/{SID}/Catalogs/{Id}/Items?Page=N&PageSize=1000
// Campos conhecidos da doc pública: Name, CurrentPrice, OriginalPrice, Gtin, Manufacturer, ImageUrl, Url (link de afiliado), Category.

export const precisa = ['IMPACT_SID', 'IMPACT_TOKEN'];
const API = 'https://api.impact.com/Mediapartners';
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export async function coletar({ catalogos = [], paginas = 5, cat = 'outros', intervaloMs = 700 } = {}) {
  const sid = process.env.IMPACT_SID, tk = process.env.IMPACT_TOKEN;
  const cab = { accept: 'application/json', authorization: 'Basic ' + Buffer.from(`${sid}:${tk}`).toString('base64') };
  if (!catalogos.length) {
    const r = await fetch(`${API}/${sid}/Catalogs`, { headers: cab });
    if (!r.ok) { console.warn(`impact catálogos: HTTP ${r.status}`); return []; }
    catalogos = ((await r.json()).Catalogs || []).map((c) => c.Id);
  }
  const saida = [];
  for (const id of catalogos) {
    for (let p = 1; p <= paginas; p++) {
      const r = await fetch(`${API}/${sid}/Catalogs/${id}/Items?Page=${p}&PageSize=1000`, { headers: cab });
      if (!r.ok) { console.warn(`impact catálogo ${id} p${p}: HTTP ${r.status}`); break; }
      const j = await r.json();
      const itens = j.Items || [];
      for (const i of itens) {
        const preco = Number(i.CurrentPrice), de = Number(i.OriginalPrice) || null;
        if (!(preco > 0)) continue;
        saida.push({
          fonte: 'impact', loja: i.CampaignName || i.Manufacturer || 'impact', titulo: i.Name, ean: i.Gtin || null, marca: i.Manufacturer || null,
          cat, catLoja: i.Category ?? null, preco, de: de > preco ? de : null, url: i.Url, img: i.ImageUrl ?? null, vendedor: { oficial: true, reputacao: null }
        });
      }
      if (itens.length < 1000) break;
      await pausa(intervaloMs);
    }
  }
  return saida;
}
