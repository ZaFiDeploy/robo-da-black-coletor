// Lê o produto do JSON-LD (schema.org/Product + Offer) de uma página pública. Sem rede.

function lista(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }

export function blocosJsonLd(html) {
  const saida = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try { const j = JSON.parse(m[1].trim()); for (const b of lista(j)) { if (b && b['@graph']) saida.push(...lista(b['@graph'])); else if (b) saida.push(b); } } catch { /* bloco quebrado: ignora */ }
  }
  return saida;
}

// "476.45" (schema.org) = 476,45; "1.299,90" (pt-BR) = 1299,90; "R$ 99,90" também.
function num(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  let t = String(v).replace(/[^\d.,]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @returns {null | { titulo, preco, de, ean, marca, modelo, img, url, disponivel, moeda }}
 */
export function produtoDoJsonLd(html) {
  const blocos = blocosJsonLd(html);
  const p = blocos.find((b) => /Product/i.test(String(b['@type'])));
  if (!p) return null;
  // ProductGroup (Decathlon, VTEX com variantes): as ofertas ficam nas variantes; pega a mais barata disponível
  const variantes = lista(p.hasVariant).filter(Boolean);
  const ofertasDasVariantes = variantes.flatMap((v) => lista(v.offers)).filter((o) => o && (num(o.price) || num(o.lowPrice)));
  const fonteOfertas = lista(p.offers).length ? p : { offers: ofertasDasVariantes.sort((a, b) => (num(a.price) ?? num(a.lowPrice)) - (num(b.price) ?? num(b.lowPrice))) };
  const ofertas = lista(fonteOfertas.offers).flatMap((o) => (o && /AggregateOffer/i.test(String(o['@type'])) ? lista(o.offers).concat([o]) : [o])).filter(Boolean);
  const o = ofertas.find((x) => num(x.price) || num(x.lowPrice)) || ofertas[0] || {};
  const preco = num(o.price) ?? num(o.lowPrice);
  if (!preco) return null;
  const spec = lista(o.priceSpecification).find((s) => s && (s.price || s.priceType));
  const de = num(p.priceDe) ?? num(o.priceBeforeDiscount) ?? (spec && /StrikethroughPrice|ListPrice/i.test(String(spec.priceType)) ? num(spec.price) : null);
  const v0 = variantes[0] || {};
  const ean = p.gtin13 || p.gtin14 || p.gtin12 || p.gtin8 || p.gtin || v0.gtin13 || v0.gtin || null;
  let marca = typeof p.brand === 'string' ? p.brand : p.brand?.name ?? null;
  if (marca && /^(n[ãa]o dispon[ií]vel|sem marca|generico|gen[ée]rica?)$/i.test(marca.trim())) marca = null;
  const img = lista(p.image).map((i) => (typeof i === 'string' ? i : i?.url)).find(Boolean) ?? null;
  return {
    titulo: String(p.name || '').trim(), preco, de: de && de > preco ? de : null, ean, marca, modelo: p.model ?? p.mpn ?? null, sku: p.sku ?? null,
    img, url: o.url || p.url || p['@id'] || null, moeda: o.priceCurrency || null,
    disponivel: o.availability ? /InStock|LimitedAvailability|PreOrder/i.test(String(o.availability)) : null
  };
}

/** Caminho de categorias do BreadcrumbList (ex.: ['TV']), sem "Início" e sem o próprio produto. */
export function categoriasDoJsonLd(html) {
  const b = blocosJsonLd(html).find((x) => /BreadcrumbList/i.test(String(x['@type'])));
  if (!b) return [];
  return lista(b.itemListElement).map((i) => (typeof i.name === 'string' ? i.name : i.item?.name) || '').filter((n) => n && !/^(in[íi]cio|home)$/i.test(n) && !/^c[óo]digo \d+$/i.test(n)).slice(0, -0 || undefined);
}
