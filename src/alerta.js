// Robô do Telegram: quem recebe o quê, sem repetir e sem virar spam.

export const REGRAS_ALERTA = {
  maxPorDia: 8,          // por pessoa
  novaQuedaMin: 0.05,    // reavisar a mesma oferta só se cair mais 5%
  scoreMin: 60           // abaixo disso o robô não indica compra
};

const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Um alvo do robô (tabela robo.alvos_robo):
 * { usuario, cats: [], termos: [], descontoMin: 0.15, orcamento: 2000, classes: ['imperdivel','otimo'] }
 */
export function combina(alvo, o) {
  if (o.classe === 'falso' || o.classe === 'sem_desconto' || o.classe === 'sem_dados') return false;
  if ((o.score ?? 0) < REGRAS_ALERTA.scoreMin) return false;
  if (alvo.classes?.length && !alvo.classes.includes(o.classe)) return false;
  if (alvo.descontoMin != null && o.real < alvo.descontoMin) return false;
  if (alvo.orcamento > 0 && o.preco > alvo.orcamento) return false;
  const temCat = !alvo.cats?.length || alvo.cats.includes(o.cat);
  const temTermo = !alvo.termos?.length || alvo.termos.some((t) => sem(o.nome).includes(sem(t)));
  return temCat && temTermo;
}

/**
 * Decide os alertas de um ciclo.
 * @param {Array} alvos
 * @param {Array} ofertas   ofertas avaliadas
 * @param {Array} enviados  [{ usuario, chave, preco, em }] (tabela robo.alertas_enviados)
 * @param {Date} agora
 */
export function planejarAlertas(alvos, ofertas, enviados = [], agora = new Date()) {
  const hoje = agora.toISOString().slice(0, 10);
  const saida = [];
  for (const alvo of alvos) {
    const meus = enviados.filter((e) => e.usuario === alvo.usuario);
    let restam = REGRAS_ALERTA.maxPorDia - meus.filter((e) => String(e.em).slice(0, 10) === hoje).length;
    const lista = ofertas.filter((o) => combina(alvo, o)).sort((a, b) => b.real - a.real);
    for (const o of lista) {
      if (restam <= 0) break;
      const ultimo = meus.filter((e) => e.chave === o.chave).sort((a, b) => a.preco - b.preco)[0];
      if (ultimo && o.preco > ultimo.preco * (1 - REGRAS_ALERTA.novaQuedaMin)) continue;
      saida.push({ usuario: alvo.usuario, chave: o.chave, preco: o.preco, texto: textoAlerta(o, { reaviso: !!ultimo }) });
      restam--;
    }
  }
  return saida;
}

const reais = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Mensagem do Telegram (parse_mode HTML). Mesmo tom do app: dinheiro, sem cassino. */
export function textoAlerta(o, { reaviso = false } = {}) {
  const cab = o.classe === 'imperdivel' ? '🔥 <b>IMPERDÍVEL</b>' : o.classe === 'otimo' ? '💎 <b>Ótimo preço</b>' : '👍 <b>Bom preço</b>';
  const linhas = [
    `${cab}${reaviso ? ' (caiu de novo)' : ''}`,
    `${esc(o.nome)}`,
    `<b>${reais(o.preco)}</b> · ${esc(o.loja)}`,
    `${Math.round(o.real * 100)}% abaixo do preço comum (${reais(o.referencia)}).`
  ];
  if (o.menorEm90) linhas.push('📉 Menor preço dos últimos 90 dias.');
  if (o.outra && o.outra.preco < o.preco) linhas.push(`⚠️ Em ${esc(o.outra.loja)} está ${reais(o.outra.preco)}.`);
  linhas.push(`🛡️ Segurança ${o.score}/100`);
  linhas.push(`<a href="${esc(o.url)}">Ver na loja →</a>`);
  return linhas.join('\n');
}
