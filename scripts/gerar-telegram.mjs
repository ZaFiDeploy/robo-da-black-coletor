// Gera os dados do app Ofertas do Telegram a partir dos dados do app do entregável.
//   node scripts/gerar-telegram.mjs <pasta dados do app> <pasta de saída>
// Usado no GitHub Actions (publico/dados → publico/telegram) e pelo gerar.mjs do app do Telegram no Mac.
// destaques.json = primeira tela, leve. todas.json = busca e departamentos (carrega depois).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [ORIGEM, DESTINO] = process.argv.slice(2);
if (!ORIGEM || !DESTINO) throw new Error('uso: node scripts/gerar-telegram.mjs <dados do app> <saída>');
mkdirSync(DESTINO, { recursive: true });

const indice = JSON.parse(readFileSync(join(ORIGEM, 'indice.json'), 'utf8'));
const CAMPOS = ['id', 'nome', 'loja', 'preco', 'de', 'mercado', 'lojas', 'url', 'img', 'classe', 'real', 'score', 'faixa', 'top', 'relampago', 'menorEm90'];
const enxuta = (o) => Object.fromEntries(CAMPOS.filter((k) => o[k] != null && o[k] !== false).map((k) => [k, o[k]]));
const anunciado = (o) => (o.de && o.de > o.preco ? 1 - o.preco / o.de : 0);

const todas = [];
const vistos = new Set();
for (const f of readdirSync(ORIGEM).filter((n) => n.startsWith('ofertas-') && n.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(ORIGEM, f), 'utf8'));
  for (const o of d.ofertas || []) {
    if (vistos.has(o.id) || !o.url || !o.preco) continue;
    vistos.add(o.id); todas.push(enxuta(o));
  }
}

const RANK = { imperdivel: 0, otimo: 1, bom: 2 };
const deVerdade = todas.filter((o) => o.classe in RANK).sort((a, b) => RANK[a.classe] - RANK[b.classe] || b.real - a.real);
const fraudes = todas.filter((o) => o.classe === 'falso').sort((a, b) => anunciado(b) - anunciado(a));
const porId = new Map(todas.map((o) => [o.id, o]));
const relampago = (indice.relampago || []).map((id) => porId.get(id)).filter(Boolean);
// Ainda não comparadas: as maiores quedas ANUNCIADAS em lojas com nota boa (≥ 60), uma por produto parecido.
const checando = todas
  .filter((o) => o.classe === 'nao_checado' && (o.score ?? 0) >= 60 && anunciado(o) >= 0.15 && anunciado(o) <= 0.8)
  .sort((a, b) => anunciado(b) - anunciado(a))
  .slice(0, 60);

const departamentos = Object.entries(indice.porDepartamento || {})
  .map(([top, d]) => ({ top, nome: d.nome, n: d.n, checadas: d.checadas || 0 }))
  .sort((a, b) => b.n - a.n);

const resumo = {
  geradoEm: indice.geradoEm, checadoEm: indice.checadoEm, total: todas.length,
  monitorados: indice.monitorados, lojasMonitoradas: indice.lojasMonitoradas, porClasse: indice.porClasse
};

writeFileSync(join(DESTINO, 'destaques.json'), JSON.stringify({ resumo, relampago, deVerdade, fraudes, checando, departamentos }));
writeFileSync(join(DESTINO, 'todas.json'), JSON.stringify(todas));
console.log(`Telegram: ${todas.length} ofertas · ${relampago.length} relâmpago · ${deVerdade.length} de verdade · ${fraudes.length} fraudes · ${checando.length} em destaque checando · ${departamentos.length} departamentos`);
