// Motor: recebe ofertas cruas de qualquer fonte e devolve ofertas avaliadas
// (produto casado, preço de referência, classe, score e Relâmpago).

import { chaveProduto, mesmoProduto, marcaDe } from './normalizar.js';
import { precoReferencia, precoMercado } from './preco.js';
import { classificar, compararOportunidades, suspeitaDoDe } from './classificar.js';
import { mediana } from './preco.js';

/** Desconto anunciado típico de cada loja (mediana e percentil 90), para saber quando um "de" destoa da própria loja. */
export function anuncioPorLoja(cruas) {
  const por = new Map();
  for (const o of cruas) {
    if (!(o.de > o.preco) || !(o.preco > 0)) continue;
    const k = String(o.loja).toLowerCase();
    if (!por.has(k)) por.set(k, []);
    por.get(k).push(1 - o.preco / o.de);
  }
  const saida = new Map();
  for (const [k, v] of por) {
    if (v.length < 10) continue; // com poucas ofertas não dá para falar em "comum da loja"
    const s = [...v].sort((a, b) => a - b);
    saida.set(k, { anunciadoComumLoja: mediana(s), anunciadoP90Loja: s[Math.min(s.length - 1, Math.floor(0.9 * s.length))] });
  }
  return saida;
}

/** Uma observação por loja (a mais barata); se sobrar exatamente 1 loja, é ela. */
function lojaUnica(outras) {
  const porLoja = new Map();
  for (const x of outras) {
    if (!(x.preco > 0)) continue;
    const k = String(x.loja || '').toLowerCase();
    if (!porLoja.has(k) || x.preco < porLoja.get(k).preco) porLoja.set(k, x);
  }
  return porLoja.size === 1 ? [...porLoja.values()][0] : null;
}

/** Maior preço já observado e nº de dias com observação (para dizer "nunca custou o 'de'"). */
function resumoMaximo(historico, agora) {
  const dias = new Set(); let maximo = 0;
  for (const h of historico || []) {
    const t = new Date(h.em).getTime();
    if (!(h.preco > 0) || !Number.isFinite(t) || t > agora.getTime()) continue;
    dias.add(Math.floor(t / 86400000)); if (h.preco > maximo) maximo = h.preco;
  }
  return { maximo, dias: dias.size };
}
import { scoreSeguranca } from './score.js';
import { escolherRelampago } from './relampago.js';

/**
 * Oferta crua (o que cada fonte entrega):
 * {
 *   fonte, loja, titulo, ean?, marca?, modelo?, cat, preco, de?, url, img?,
 *   vendedor?: { oficial?: boolean, reputacao?: 'alta'|'media'|'baixa'|'nova' },
 *   soPix?: boolean, idadeDominioDias?: number, temCnpj?: boolean,
 *   comparacao?: { mercado?: number, lojas?: number, outra?: {loja, preco}, outras?: [{loja, preco}], checadoEm?: string }
 * }
 */

/** id numérico estável (o app usa número em data-salvar). */
export function idEstavel(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 2147483647 || 1;
}

/** Junta as ofertas que são o mesmo produto. Bloco = categoria + marca, para não comparar tudo com tudo. */
export function agrupar(ofertas) {
  const grupos = [];
  const porChave = new Map();
  const porBloco = new Map();
  for (const o of ofertas) {
    const { chave, confianca } = chaveProduto(o);
    o.chave = chave; o.confianca = confianca;
    if (porChave.has(chave)) { porChave.get(chave).push(o); continue; }
    const bloco = `${o.cat}|${marcaDe(o.titulo, o.marca) || '?'}`;
    const vizinhos = porBloco.get(bloco) || [];
    const par = confianca !== 'alta' && vizinhos.find((g) => g[0].confianca !== 'alta' && mesmoProduto(g[0], o).mesmo);
    if (par) { o.chave = par[0].chave; par.push(o); continue; }
    const g = [o];
    grupos.push(g); porChave.set(chave, g); vizinhos.push(g); porBloco.set(bloco, vizinhos);
  }
  return grupos;
}

/**
 * @param {Array} cruas
 * @param {object} [opts]
 * @param {Map<string, Array>} [opts.historicos]  chave -> [{preco, em}]
 * @param {Date} [opts.agora]
 */
export function avaliar(cruas, { historicos = new Map(), agora = new Date() } = {}) {
  const avaliadas = [];
  const anuncioLoja = anuncioPorLoja(cruas);
  for (const grupo of agrupar(cruas.map((o) => ({ ...o })))) {
    for (const o of grupo) {
      // outras lojas: as do mesmo grupo nesta coleta + as comparações que a fonte trouxe (busca cruzada, checagem à mão)
      const outras = grupo.filter((x) => x !== o && x.loja !== o.loja).map((x) => ({ loja: x.loja, preco: x.preco }));
      if (o.comparacao?.outras) outras.push(...o.comparacao.outras.filter((x) => x && x.preco > 0 && String(x.loja).toLowerCase() !== String(o.loja).toLowerCase()));
      const historico = historicos.get(o.chave) || o.historico || [];
      const ref = precoReferencia({ outras, historico, agora });
      let referencia = ref.referencia, base = ref.base, mercado = ref.mercado.mercado, lojas = ref.mercado.lojas, menor = ref.mercado.menor, lojaRef = null;
      // checagem manual (Google Shopping à mão) entra como mercado quando não há lista de preços
      if (!mercado && o.comparacao?.mercado > 0) {
        mercado = o.comparacao.mercado; lojas = o.comparacao.lojas ?? null; menor = o.comparacao.outra ?? null;
        if (!referencia) { referencia = mercado; base = 'mercado'; }
      }
      // uma única outra loja vendendo o mesmo produto hoje: vale como referência, dito como "1 loja comparada" (nunca como mercado)
      if (!referencia) {
        const unica = lojaUnica(outras);
        if (unica) { referencia = unica.preco; mercado = unica.preco; base = 'loja_unica'; lojas = 1; menor = unica; lojaRef = unica.loja; }
      }
      const suspeita = referencia ? null : suspeitaDoDe({ preco: o.preco, de: o.de, ...anuncioLoja.get(String(o.loja).toLowerCase()), historico: resumoMaximo(historico, agora) });
      const c = classificar({ preco: o.preco, de: o.de, referencia, mercado, minimo90: ref.historico.minimo90, base, lojas, lojaRef, suspeita });
      const s = scoreSeguranca({
        url: o.url, lojaOficial: o.vendedor?.oficial, reputacao: o.vendedor?.reputacao,
        idadeDominioDias: o.idadeDominioDias, soPix: o.soPix, temCnpj: o.temCnpj,
        realVsMercado: mercado ? 1 - o.preco / mercado : null
      });
      avaliadas.push({
        id: idEstavel(o.chave + '|' + o.loja + '|' + o.url),
        chave: o.chave, confianca: o.confianca, nome: o.titulo, cat: o.cat, loja: o.loja,
        top: o.top ?? null, sub: o.sub ?? null, subNome: o.subNome ?? null, publico: o.publico ?? null,
        preco: o.preco, de: o.de > o.preco ? o.de : o.preco, url: o.url, img: o.img ?? null,
        referencia, base, mercado, lojas, lojaRef, outra: menor && menor.preco < o.preco ? { loja: menor.loja, preco: menor.preco, ...(menor.url ? { url: menor.url } : {}) } : null,
        classe: c.classe, real: c.real, anunciado: c.anunciado, economia: c.economia, menorEm90: c.menorEm90, motivo: c.motivo,
        score: s.score, faixa: s.faixa, motivosScore: s.motivos, motivosClasse: c.motivos,
        quedaHoje: o.quedaHoje ?? 0, checadoEm: o.comparacao?.checadoEm ?? agora.toISOString()
      });
    }
  }
  avaliadas.sort(compararOportunidades);
  // Relâmpago só com preço de mercado de verdade (2+ lojas ou histórico): 1 loja comparada é indício, não queda confirmada
  const relampago = escolherRelampago(avaliadas.filter((o) => o.base !== 'loja_unica'));
  const idsRel = new Set(relampago.map((o) => o.id));
  for (const o of avaliadas) o.relampago = idsRel.has(o.id);
  return { ofertas: avaliadas, relampago };
}

export { precoMercado };
