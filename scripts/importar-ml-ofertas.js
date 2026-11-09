// Converte as linhas coletadas em mercadolivre.com.br/ofertas (pelo Chrome do Milton) em ofertas cruas do coletor.
// Entrada (texto): T|top|sub~nome~qtd^...   e   C|top|sub|tipo+id|preco|de|imagem|titulo
// Uso: node scripts/importar-ml-ofertas.js coleta.txt amostras/ml-ofertas-AAAA-MM-DD.json amostras/ml-taxonomia-AAAA-MM-DD.json
import { readFileSync, writeFileSync } from 'node:fs';
import { TOPOS_ML } from '../src/departamentos.js';

const [entrada, saidaOfertas, saidaTaxo] = process.argv.slice(2);
const checadoEm = process.env.COLETADO_EM || new Date().toISOString();
const taxo = {}, nomesSub = {}, ofertas = [], vistos = new Set();

for (const linha of readFileSync(entrada, 'utf8').split('\n')) {
  const p = linha.split('|');
  if (p[0] === 'T') {
    const subs = (p[2] || '').split('^').filter(Boolean).map((x) => { const [id, nome, n] = x.split('~'); return { id, nome, n: +n || 0 }; });
    taxo[p[1]] = { nome: TOPOS_ML[p[1]]?.nome, subs };
    for (const s of subs) nomesSub[s.id] = s.nome;
  }
}
for (const linha of readFileSync(entrada, 'utf8').split('\n')) {
  const p = linha.split('|');
  if (p[0] !== 'C' || p.length < 8) continue;
  const [, top, sub, cod, preco, de, img] = p;
  const titulo = p.slice(7).join('|').trim();
  if (!TOPOS_ML[top] || vistos.has(cod)) continue;
  vistos.add(cod);
  const tipo = cod[0], id = cod.slice(1);
  const url = tipo === 'p' ? `https://www.mercadolivre.com.br/p/${id}`
    : tipo === 'u' ? `https://www.mercadolivre.com.br/up/${id}`
    : `https://produto.mercadolivre.com.br/MLB-${id}`;
  ofertas.push({
    fonte: 'ml-ofertas', loja: 'Mercado Livre', titulo, cat: TOPOS_ML[top].cat, top, sub, subNome: nomesSub[sub] || null,
    preco: +preco, de: +de, url, img: img ? `https://http2.mlstatic.com/D_Q_NP_2X_${img}.webp` : null,
    vendedor: { oficial: null, reputacao: null }, coletadoEm: checadoEm
  });
}
writeFileSync(saidaOfertas, JSON.stringify(ofertas, null, 1) + '\n');
writeFileSync(saidaTaxo, JSON.stringify(taxo, null, 1) + '\n');
console.log(`ofertas: ${ofertas.length} · categorias de topo: ${Object.keys(taxo).length}`);
