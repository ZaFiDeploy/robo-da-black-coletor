// Relâmpago: 5 por dia, as maiores quedas REAIS do momento.
// Regras: só Imperdível/Ótimo, loja segura (score ≥ 80), no máximo 2 por categoria,
// um por produto, e quem caiu de preço nas últimas 24 h passa na frente no empate.

// Se não houver 5 com score ≥ 80, completa com score ≥ 70 (a promessa é 5 por dia; abaixo de 70 nunca).
export const REGRAS_RELAMPAGO = { quantidade: 5, scoreMin: 80, scoreMinReserva: 70, maxPorCategoria: 2, classes: ['imperdivel', 'otimo'] };

/**
 * @param {Array} ofertas  ofertas já avaliadas: { id, chave, cat, classe, real, score, quedaHoje? }
 */
export function escolherRelampago(ofertas, regras = REGRAS_RELAMPAGO) {
  const fortes = escolher(ofertas, regras, regras.scoreMin, []);
  if (fortes.length >= regras.quantidade || regras.scoreMinReserva == null) return fortes;
  return escolher(ofertas, regras, regras.scoreMinReserva, fortes);
}

function escolher(ofertas, regras, scoreMin, jaEscolhidas) {
  const candidatas = ofertas
    .filter((o) => regras.classes.includes(o.classe) && (o.score ?? 0) >= scoreMin)
    .sort((a, b) => (b.real - a.real) || ((b.quedaHoje ?? 0) - (a.quedaHoje ?? 0)) || String(a.id).localeCompare(String(b.id)));
  const porCat = new Map(), produtos = new Set(), saida = [...jaEscolhidas];
  for (const o of saida) { produtos.add(o.chave); porCat.set(o.cat, (porCat.get(o.cat) || 0) + 1); }
  for (const o of candidatas) {
    if (saida.length >= regras.quantidade) break;
    if (produtos.has(o.chave)) continue;
    if ((porCat.get(o.cat) || 0) >= regras.maxPorCategoria) continue;
    produtos.add(o.chave);
    porCat.set(o.cat, (porCat.get(o.cat) || 0) + 1);
    saida.push(o);
  }
  return saida;
}
