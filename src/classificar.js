// Classes do desconto real. Mesma régua do app (robo-da-black/app.js → avaliar()).
//   real      = 1 - preço / preço de referência
//   anunciado = 1 - preço / preço "de" que a loja mostra

export const LIMIARES = {
  imperdivel: 0.30,
  otimo: 0.15,
  bom: 0.05,
  falsoAnunciadoMin: 0.10, // loja diz que dá 10% ou mais...
  falsoRealMax: 0.05,      // ...e o desconto real é menor que 5%
  travaMercado: 0.02,      // mais de 2% acima do mercado hoje não pode ser "oportunidade"
  // "de" suspeito (sem referência para julgar): anúncio bem acima do comum da própria loja, ou "de" que o produto nunca custou
  suspeitoAnuncioMin: 0.45,
  suspeitoDeAcimaDoMaximo: 1.02,
  suspeitoDiasMin: 2
};

export const CLASSES = {
  imperdivel: { nome: 'Imperdível', peso: 3 },
  otimo: { nome: 'Ótimo preço', peso: 2 },
  bom: { nome: 'Bom preço', peso: 1 },
  sem_desconto: { nome: 'Sem desconto real', peso: 0 },
  suspeito: { nome: 'Desconto suspeito', peso: -0.5 },
  falso: { nome: 'Desconto falso', peso: -1 },
  sem_dados: { nome: 'Sem dados para julgar', peso: -2 }
};

const arred = (n) => Math.round(n * 1000) / 1000;
const pct = (x) => Math.round(x * 100) + '%';
const reais = (n) => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * O "de" que a loja mostra é plausível? Só é chamado quando NÃO há preço de referência (senão a régua normal decide).
 * @param {object} p
 * @param {number} p.preco
 * @param {number} [p.de]
 * @param {number} [p.anunciadoComumLoja]  mediana do desconto anunciado nessa loja (0–1)
 * @param {number} [p.anunciadoP90Loja]    percentil 90 do desconto anunciado nessa loja (0–1)
 * @param {{maximo:number, dias:number}} [p.historico]  maior preço já observado deste produto e nº de dias com observação
 * @returns {{motivo:string}|null}
 */
export function suspeitaDoDe({ preco, de, anunciadoComumLoja, anunciadoP90Loja, historico }) {
  if (!(preco > 0) || !(de > preco)) return null;
  const anunciado = 1 - preco / de;
  if (historico && historico.dias >= LIMIARES.suspeitoDiasMin && historico.maximo > 0 && de > historico.maximo * LIMIARES.suspeitoDeAcimaDoMaximo && anunciado >= LIMIARES.falsoAnunciadoMin) {
    return { motivo: `em ${historico.dias} dias vigiando nunca custou ${reais(de)}; o maior preço visto foi ${reais(historico.maximo)}` };
  }
  if (anunciado >= LIMIARES.suspeitoAnuncioMin && anunciadoP90Loja > 0 && anunciado >= anunciadoP90Loja && anunciadoComumLoja > 0) {
    return { motivo: `loja diz -${pct(anunciado)}, bem acima do comum dela (-${pct(anunciadoComumLoja)}); sem outra loja para conferir` };
  }
  return null;
}

/**
 * @param {object} p
 * @param {number} p.preco        preço atual da oferta
 * @param {number} [p.de]         preço riscado que a loja mostra
 * @param {number} p.referencia   preço comum (precoReferencia().referencia)
 * @param {number} [p.mercado]    mediana do mercado hoje, quando existe (trava)
 * @param {number} [p.minimo90]   menor preço dos últimos 90 dias, quando existe
 * @param {string} [p.base]       'mercado' | 'historico' | 'loja_unica' (só para a frase)
 * @param {number} [p.lojas]      quantas outras lojas entraram na referência
 * @param {string} [p.lojaRef]    nome da outra loja quando base = 'loja_unica'
 * @param {{motivo:string}|null} [p.suspeita]  resultado de suspeitaDoDe(), usado só sem referência
 */
export function classificar({ preco, de, referencia, mercado, minimo90, base, lojas, lojaRef, suspeita }) {
  if (!(preco > 0) || !(referencia > 0)) {
    const anunciado = de > 0 ? arred(1 - preco / de) : null;
    if (suspeita?.motivo) return { classe: 'suspeito', real: null, anunciado, economia: 0, motivos: [suspeita.motivo], motivo: suspeita.motivo };
    const motivo = 'nenhuma outra loja que aceita robô vende este produto e ainda não há histórico de preço';
    return { classe: 'sem_dados', real: null, anunciado, economia: 0, motivos: ['sem preço de referência'], motivo };
  }
  const real = 1 - preco / referencia;
  const anunciado = de > preco ? 1 - preco / de : 0;
  const motivos = [];
  let classe;

  if (anunciado >= LIMIARES.falsoAnunciadoMin && real < LIMIARES.falsoRealMax) {
    classe = 'falso';
    motivos.push(`loja diz -${Math.round(anunciado * 100)}%, real ${Math.round(real * 100)}%`);
  } else if (real >= LIMIARES.imperdivel) classe = 'imperdivel';
  else if (real >= LIMIARES.otimo) classe = 'otimo';
  else if (real >= LIMIARES.bom) classe = 'bom';
  else classe = 'sem_desconto';

  // Trava: abaixo do histórico mas acima do que as outras lojas cobram hoje não é oportunidade.
  if (classe !== 'falso' && mercado > 0 && preco > mercado * (1 + LIMIARES.travaMercado)) {
    motivos.push(`acima do mercado hoje (${mercado.toFixed(2)})`);
    classe = 'sem_desconto';
  }

  const menorEm90 = minimo90 > 0 ? preco <= minimo90 : null;
  if (menorEm90) motivos.push('menor preço em 90 dias');
  if (base === 'loja_unica') motivos.push(`comparado com 1 loja (${lojaRef || 'outra loja'})`);

  const motivo = fraseMotivo({ classe, real, anunciado, referencia, base, lojas, lojaRef });
  return { classe, real: arred(real), anunciado: arred(anunciado), economia: Math.max(0, Math.round((referencia - preco) * 100) / 100), menorEm90, motivos, motivo };
}

/** O porquê em uma linha, no tom do app: fato comparado, nunca certeza além do que foi medido. */
export function fraseMotivo({ classe, real, anunciado, referencia, base, lojas, lojaRef }) {
  const onde = base === 'loja_unica' ? `na ${lojaRef || 'outra loja'}` : base === 'historico' ? 'na mediana dos últimos 60 dias' : `em ${lojas || 'outras'} lojas hoje`;
  const comum = base === 'loja_unica' ? `${lojaRef || 'a outra loja'} vende por ${reais(referencia)} hoje` : base === 'historico' ? `custava ${reais(referencia)} em média nos últimos 60 dias` : `o preço comum em ${lojas || 'outras'} lojas hoje é ${reais(referencia)}`;
  if (classe === 'falso') return `loja diz -${pct(anunciado)}, mas ${comum}`;
  if (classe === 'sem_desconto') return real < -0.02 ? `${pct(-real)} acima do preço ${onde} (${reais(referencia)})` : `mesmo preço ${onde}: ${comum}`;
  return `${pct(real)} abaixo do preço ${onde} (${reais(referencia)})` + (base === 'loja_unica' ? ' · só 1 loja comparada' : '');
}

/** Ordena para vitrine: classe primeiro, depois desconto real. */
export function compararOportunidades(a, b) {
  return (CLASSES[b.classe].peso - CLASSES[a.classe].peso) || ((b.real ?? -1) - (a.real ?? -1));
}
