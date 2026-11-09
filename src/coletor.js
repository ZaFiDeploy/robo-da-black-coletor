#!/usr/bin/env node
// Coletor: fonte(s) → motor → JSON/JS no formato do app.
// Exemplo (sem rede, sem chave):
//   node src/coletor.js --fonte manual --entrada amostras/ml-2026-11-07.json --saida saida

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { avaliar } from './motor.js';
import { montarSaida, montarPorDepartamento } from './exportar.js';
import { classificarCategorias } from './categorias-fonte.js';

const FONTES = {
  manual: () => import('./fontes/manual.js'),
  sitemap: () => import('./fontes/sitemap.js'),
  lomadee: () => import('./fontes/lomadee.js'),
  impact: () => import('./fontes/impact.js'),
  tiktok: () => import('./fontes/tiktok.js'),
  mercadolivre: () => import('./fontes/mercadolivre.js'),
  shopee: () => import('./fontes/shopee.js'),
  awin: () => import('./fontes/awin.js')
};

const { values: a } = parseArgs({
  options: {
    fonte: { type: 'string', multiple: true, default: ['manual'] },
    entrada: { type: 'string' },
    termos: { type: 'string' },
    loja: { type: 'string' },
    limite: { type: 'string' },
    'por-sitemap': { type: 'string' },
    saida: { type: 'string', default: 'saida' },
    'sem-amostra': { type: 'boolean', default: false }
  }
});

const cruas = [];
for (const nome of a.fonte) {
  if (!FONTES[nome]) { console.error(`fonte desconhecida: ${nome}`); process.exit(1); }
  const fonte = await FONTES[nome]();
  const faltam = fonte.precisa.filter((v) => !process.env[v]);
  if (faltam.length) { console.warn(`· ${nome}: pulada, falta ${faltam.join(', ')}`); continue; }
  const lista = await fonte.coletar({ entrada: a.entrada, termos: a.termos ? a.termos.split(',') : [], loja: a.loja, limite: a.limite ? +a.limite : undefined, porSitemap: a['por-sitemap'] ? +a['por-sitemap'] : 0, log: (m) => console.log('  ' + m) });
  console.log(`· ${nome}: ${lista.length} ofertas cruas`);
  cruas.push(...lista);
  // Coleta de sitemap: guarda a amostra do dia (o gerar-ofertas-app.js lê amostras/) e uma fotografia de preço por rodada
  // (amostras/historico/), para o histórico e o antes x agora funcionarem com 2 ou 3 dias e várias rodadas no mesmo dia.
  if (nome === 'sitemap' && lista.length && !a['sem-amostra']) {
    const amostras = new URL('../amostras/', import.meta.url);
    const agoraSP = new Date();
    const dia = agoraSP.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const hora = agoraSP.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).replace(':', '');
    await mkdir(new URL('historico/', amostras), { recursive: true });
    const nomeAmostra = `${a.loja}-sitemap-${dia}.json`;
    let juntas = lista;
    try { const antes = JSON.parse(await readFile(new URL(nomeAmostra, amostras), 'utf8')); const urls = new Set(lista.map((o) => o.url)); juntas = antes.filter((o) => !urls.has(o.url)).concat(lista); } catch { /* primeira rodada do dia */ }
    await writeFile(new URL(nomeAmostra, amostras), JSON.stringify(juntas, null, 1));
    await writeFile(new URL(`historico/${dia}T${hora}-${a.loja}.json`, amostras), JSON.stringify(lista.map((o) => ({ url: o.url, preco: o.preco, de: o.de ?? null, em: o.coletadoEm }))));
    console.log(`· amostra: amostras/${nomeAmostra} (${juntas.length}) e fotografia amostras/historico/${dia}T${hora}-${a.loja}.json`);
  }
}
if (!cruas.length) { console.error('nenhuma oferta coletada'); process.exit(1); }

classificarCategorias(cruas);
const agora = new Date();
const resultado = avaliar(cruas, { agora });
const { json, js } = montarSaida(resultado, { agora });

await mkdir(a.saida, { recursive: true });
await writeFile(join(a.saida, 'ofertas.json'), JSON.stringify(json, null, 1));
await writeFile(join(a.saida, 'ofertas.js'), js);
await writeFile(join(a.saida, 'avaliadas.json'), JSON.stringify(resultado.ofertas, null, 1)); // tudo, com motivos (auditoria)
const { indice, arquivos } = montarPorDepartamento(resultado, { agora });
await mkdir(join(a.saida, 'dados'), { recursive: true });
await writeFile(join(a.saida, 'dados', 'indice.json'), JSON.stringify(indice, null, 1));
for (const [nome, conteudo] of Object.entries(arquivos)) await writeFile(join(a.saida, 'dados', nome), JSON.stringify(conteudo));

console.log(`\nAvaliadas: ${resultado.ofertas.length} · na vitrine: ${json.total} · Relâmpago: ${json.relampago.length}`);
console.log('Por classe (vitrine):', json.porClasse);
for (const o of resultado.ofertas) {
  const pct = o.real == null ? '  —  ' : `${(o.real * 100).toFixed(0).padStart(4)}%`;
  console.log(`${o.classe.padEnd(12)} ${pct}  score ${String(o.score).padStart(3)} (${o.faixa.padEnd(7)}) ${o.relampago ? '⚡' : ' '} ${o.nome.slice(0, 52)}`);
}
console.log(`\nArquivos em ${a.saida}/: ofertas.json, ofertas.js (drop-in do app), avaliadas.json, dados/indice.json + ${Object.keys(arquivos).length} arquivos por departamento`);
