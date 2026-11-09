// Preço de referência ("preço comum") de um produto.
//   Hoje:   mediana do MESMO produto em outras lojas no dia (sem extremos).
//   Depois: histórico próprio (mediana de 60 dias e mínimo de 90 dias).

export const REGRAS_PRECO = {
  minLojasMercado: 2,       // abaixo disso não existe "preço de mercado"
  minDiasHistorico: 14,     // dias com observação dentro da janela de 60 para usar o histórico
  janelaMediana: 60,
  janelaMinimo: 90,
  cortarExtremos: 0.2       // tira 20% de cada ponta quando há 5+ preços
};

const DIA = 24 * 60 * 60 * 1000;

export function mediana(nums) {
  const v = nums.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Mediana sem extremos: com 5+ preços corta 20% de cada ponta (loja com preço errado, kit, usado). */
export function medianaAparada(nums, corte = REGRAS_PRECO.cortarExtremos) {
  const v = nums.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (v.length < 5) return mediana(v);
  const k = Math.floor(v.length * corte);
  return mediana(v.slice(k, v.length - k));
}

/**
 * Preço de mercado no dia.
 * @param {Array<{loja:string, preco:number}>} outras  preços do mesmo produto em OUTRAS lojas (a própria oferta fica fora)
 */
export function precoMercado(outras) {
  // uma observação por loja (a menor), para uma loja com 10 vendedores não puxar a mediana
  const porLoja = new Map();
  for (const o of outras || []) {
    if (!(o.preco > 0)) continue;
    const k = String(o.loja || '').toLowerCase();
    if (!porLoja.has(k) || o.preco < porLoja.get(k).preco) porLoja.set(k, o);
  }
  const lista = [...porLoja.values()];
  if (lista.length < REGRAS_PRECO.minLojasMercado) return { mercado: null, lojas: lista.length, menor: null };
  const menor = lista.reduce((a, b) => (b.preco < a.preco ? b : a));
  return { mercado: medianaAparada(lista.map((o) => o.preco)), lojas: lista.length, menor };
}

/**
 * Resumo do histórico próprio.
 * @param {Array<{preco:number, em:string|Date}>} hist  observações (qualquer loja) do mesmo produto
 * @param {Date} agora
 */
export function resumoHistorico(hist, agora = new Date()) {
  const t0 = agora.getTime();
  const menorPorDia = new Map(); // menor preço de cada dia: é o que o comprador conseguiria pagar
  for (const h of hist || []) {
    const t = new Date(h.em).getTime();
    if (!(h.preco > 0) || !Number.isFinite(t) || t > t0) continue;
    const dia = Math.floor(t / DIA);
    if (!menorPorDia.has(dia) || h.preco < menorPorDia.get(dia).preco) menorPorDia.set(dia, { preco: h.preco, t });
  }
  const dias = [...menorPorDia.values()];
  const em = (janela) => dias.filter((d) => t0 - d.t <= janela * DIA).map((d) => d.preco);
  const j60 = em(REGRAS_PRECO.janelaMediana), j90 = em(REGRAS_PRECO.janelaMinimo);
  return {
    diasObservados60: j60.length,
    mediana60: mediana(j60),
    minimo90: j90.length ? Math.min(...j90) : null,
    suficiente: j60.length >= REGRAS_PRECO.minDiasHistorico
  };
}

/**
 * Decide o preço de referência. Régua conservadora: o desconto real é o MENOR dos dois descontos.
 *   - histórico suficiente E mercado hoje: referência = o menor dos dois
 *     (protege contra loja que subiu o preço em outubro para "dar desconto" em novembro,
 *      e contra produto que está mais barato em outra loja hoje)
 *   - só um dos dois: usa o que tem
 *   - nenhum: não dá para julgar (null)
 */
export function precoReferencia({ outras, historico, agora } = {}) {
  const m = precoMercado(outras);
  const h = resumoHistorico(historico, agora);
  if (h.suficiente && m.mercado) {
    const hist = h.mediana60 <= m.mercado;
    return { referencia: hist ? h.mediana60 : m.mercado, base: hist ? 'historico' : 'mercado', mercado: m, historico: h };
  }
  if (h.suficiente) return { referencia: h.mediana60, base: 'historico', mercado: m, historico: h };
  if (m.mercado) return { referencia: m.mercado, base: 'mercado', mercado: m, historico: h };
  return { referencia: null, base: null, mercado: m, historico: h };
}
