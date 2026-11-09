// "Caça Black Fraude": o preço do produto que a pessoa quer, ANTES x AGORA.
// Entrada: o histórico que o coletor grava (menor preço do dia). Saída: veredito + frase pronta.
//
// Vereditos:
//   caiu          agora ≥ 5% abaixo do preço de antes        → desconto de verdade
//   igual         dentro de ±5%                               → sem desconto (e falso se a loja anuncia ≥ 10%)
//   subiu         agora ≥ 5% acima de antes                    → mais caro que antes
//   maquiagem     subiu ≥ 10% e "baixou" de volta ao preço do começo → Black Fraude clássica
//   sem_historico menos de 5 dias vigiando                     → ainda não dá para dizer

export const REGRAS_AD = {
  minDias: 5,          // dias com preço antes de hoje para dar veredito
  janelaAntes: 45,     // olha no máximo 45 dias para trás
  diasInicio: 3,       // "preço do começo" = mediana dos 3 primeiros dias vigiados
  variacao: 0.05,      // ±5% = mesmo preço
  pico: 0.10,          // subida mínima para contar como "inflou"
  anuncioFalso: 0.10   // loja anuncia ≥ 10% de desconto
};

const DIA = 86400000;
const reais = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (t) => new Date(t).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
const diaSP = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD

function mediana(v) {
  const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Menor preço de cada dia (fuso de São Paulo), em ordem. */
export function serieDiaria(historico) {
  const porDia = new Map();
  for (const h of historico || []) {
    const t = new Date(h.em).getTime();
    if (!(h.preco > 0) || !Number.isFinite(t)) continue;
    const d = diaSP(t);
    if (!porDia.has(d) || h.preco < porDia.get(d)) porDia.set(d, h.preco);
  }
  return [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, preco]) => ({ dia, preco }));
}

/**
 * @param {object} p
 * @param {Array<{preco:number, em:string|Date}>} p.historico
 * @param {number} p.precoAgora
 * @param {number} [p.de]      preço riscado que a loja mostra agora
 * @param {Date}   [p.agora]
 */
export function compararAntesDepois({ historico, precoAgora, de, agora = new Date() }, R = REGRAS_AD) {
  const hoje = diaSP(agora);
  const limite = diaSP(agora.getTime() - R.janelaAntes * DIA);
  const serie = serieDiaria(historico).filter((d) => d.dia >= limite);
  const antesDeHoje = serie.filter((d) => d.dia < hoje);
  const desde = serie[0]?.dia ?? hoje;
  const anunciado = de > precoAgora ? 1 - precoAgora / de : 0;

  if (antesDeHoje.length < R.minDias) {
    const faltam = R.minDias - antesDeHoje.length;
    return {
      veredito: 'sem_historico', agora: precoAgora, diasVigiados: antesDeHoje.length, desde, serie,
      frase: `Começamos a vigiar em ${dataBR(desde + 'T12:00:00-03:00')}. Em ${faltam} ${faltam === 1 ? 'dia' : 'dias'} mostramos o antes e o agora.`
    };
  }

  const precos = antesDeHoje.map((d) => d.preco);
  const antes = mediana(precos);
  const inicio = mediana(precos.slice(0, R.diasInicio));
  const iPico = precos.indexOf(Math.max(...precos));
  const pico = precos[iPico];
  const minimo = Math.min(...precos);
  const variacao = precoAgora / antes - 1;
  const base = { agora: precoAgora, antes, inicio, pico, minimo, variacao: Math.round(variacao * 1000) / 1000, diasVigiados: antesDeHoje.length, desde, serie, anunciado: Math.round(anunciado * 1000) / 1000 };

  // Maquiagem: inflou depois do começo e agora "baixou" para perto do preço do começo.
  const inflou = iPico >= 1 && pico >= inicio * (1 + R.pico);
  const voltouAoComeco = precoAgora >= inicio * (1 - R.variacao) && precoAgora <= pico * (1 - R.pico);
  if (inflou && voltouAoComeco) {
    return { ...base, veredito: 'maquiagem', frase: `Black Fraude: subiu de ${reais(inicio)} para ${reais(pico)} e "baixou" para ${reais(precoAgora)}. Na prática, é o preço de antes.` };
  }
  if (variacao <= -R.variacao) {
    const menor = precoAgora <= minimo;
    return { ...base, veredito: 'caiu', menorPreco: menor, frase: `Caiu ${Math.round(-variacao * 100)}% de verdade: custava ${reais(antes)}, agora ${reais(precoAgora)}.${menor ? ' Menor preço desde que começamos a vigiar.' : ''}` };
  }
  if (variacao >= R.variacao) {
    return { ...base, veredito: 'subiu', frase: `Está ${Math.round(variacao * 100)}% mais caro que antes (${reais(antes)}).${anunciado >= R.anuncioFalso ? ` O "-${Math.round(anunciado * 100)}%" da loja é falso.` : ''}` };
  }
  return {
    ...base, veredito: 'igual',
    frase: anunciado >= R.anuncioFalso
      ? `Mesmo preço de antes (${reais(antes)}). O "-${Math.round(anunciado * 100)}%" da loja é falso.`
      : `Mesmo preço de antes (${reais(antes)}). Sem desconto real.`
  };
}
