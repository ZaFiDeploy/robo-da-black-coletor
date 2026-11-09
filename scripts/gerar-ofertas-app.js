// Gera os dados do app a partir de TODAS as coletas disponíveis:
//   - amostras/ml-2026-11-07.json      (17 do ML checadas à mão, com preço de outras lojas)
//   - amostras/ml-ofertas-*.json       (coleta do ML pelo Chrome)
//   - amostras/kabum-sitemap-*.json    (sitemap educada do KaBuM!)
//   - amostras/*-feed-*.json           (feeds de afiliado, quando existirem)
// Saída: ../robo-da-black/ofertas-ml.js (reserva, tudo num arquivo) e ../robo-da-black/dados/ (indice.json + um JSON por departamento).
// Uso: node scripts/gerar-ofertas-app.js
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { avaliar } from '../src/motor.js';
import { montarSaida, montarPorDepartamento } from '../src/exportar.js';
import { classificarCategorias } from '../src/categorias-fonte.js';
import { idDoLink } from '../src/links.js';

const aqui = new URL('../amostras/', import.meta.url);
const app = new URL('../../robo-da-black/', import.meta.url);
const arquivos = readdirSync(aqui).filter((n) => /^(ml-2026-|ml-ofertas-|.*-sitemap-|.*-feed-).*\.json$/.test(n)).sort();
const chaveDe = (url) => idDoLink(url)?.chave || url;
const cruas = [], vistas = new Map(); // chave da URL -> oferta crua que ficou
const historico = new Map();          // chave da URL -> [{preco, em}] com TODAS as observações (todas as coletas, todos os dias)
const observar = (url, preco, em) => { if (!(preco > 0) || !em) return; const k = chaveDe(url); if (!historico.has(k)) historico.set(k, []); historico.get(k).push({ preco, em }); };
for (const n of arquivos) {
  const lista = JSON.parse(readFileSync(new URL(n, aqui), 'utf8'));
  let novas = 0;
  for (const o of lista) {
    const k = chaveDe(o.url);
    observar(o.url, o.preco, o.coletadoEm || o.checadoEm || o.comparacao?.checadoEm);
    if (vistas.has(k)) { const antiga = vistas.get(k); if (o.coletadoEm && (!antiga.coletadoEm || o.coletadoEm > antiga.coletadoEm) && !antiga.comparacao) Object.assign(antiga, o); continue; } // mesma URL em duas coletas: fica a mais recente (a checada à mão nunca é substituída)
    vistas.set(k, o); cruas.push(o); novas++;
  }
  console.log(`${n}: ${lista.length} lidas, ${novas} novas`);
}
// fotografias de preço (amostras/historico/*.json: [{url, preco, de, em}]) gravadas a cada rodada do coletor
const pastaHist = new URL('historico/', aqui);
if (existsSync(pastaHist)) {
  let n = 0;
  for (const f of readdirSync(pastaHist).filter((x) => x.endsWith('.json'))) for (const h of JSON.parse(readFileSync(new URL(f, pastaHist), 'utf8'))) { observar(h.url, h.preco, h.em); n++; }
  console.log(`historico/: ${n} observações`);
}
// busca cruzada (amostras/cruzado-<loja>-<data>.json): o mesmo produto em OUTRA loja → comparacao.outras, e a outra loja entra como monitorada
let pares = 0, novasOutras = 0;
for (const n of readdirSync(aqui).filter((x) => /^cruzado-.*\.json$/.test(x)).sort()) {
  for (const p of JSON.parse(readFileSync(new URL(n, aqui), 'utf8'))) {
    const o = vistas.get(chaveDe(p.url)); const x = p.outra;
    if (!o || !x || !(x.preco > 0)) continue;
    o.comparacao = o.comparacao || {};
    o.comparacao.outras = (o.comparacao.outras || []).filter((y) => y.loja !== x.loja).concat([{ loja: x.loja, preco: x.preco, url: x.url || null }]);
    o.comparacao.checadoEm = x.coletadoEm || o.comparacao.checadoEm;
    pares++;
    if (x.url) {
      observar(x.url, x.preco, x.coletadoEm);
      const kx = chaveDe(x.url);
      if (!vistas.has(kx)) {
        const crua = { fonte: 'cruzado-' + n.split('-')[1], loja: x.loja, titulo: x.titulo, ean: x.ean ?? null, marca: x.marca ?? null, modelo: x.modelo ?? null, cat: null, catLoja: o.catLoja ?? null, caminhoLoja: o.caminhoLoja ?? [], preco: x.preco, de: x.de ?? null, url: x.url, img: x.img ?? null, vendedor: { oficial: true, nome: x.vendedor ?? null, reputacao: null }, disponivel: true, coletadoEm: x.coletadoEm };
        vistas.set(kx, crua); cruas.push(crua); novasOutras++;
      }
    }
  }
}
if (pares) console.log(`busca cruzada: ${pares} ofertas com preço de outra loja, ${novasOutras} produtos novos monitorados`);
for (const o of cruas) { const h = historico.get(chaveDe(o.url)); if (h && h.length) o.historico = h; }
classificarCategorias(cruas);
const agora = new Date();
const resultado = avaliar(cruas, { agora });
const { json, js } = montarSaida(resultado, { agora });
const { indice, arquivos: porDep } = montarPorDepartamento(resultado, { agora });

mkdirSync(new URL('dados/', app), { recursive: true });
writeFileSync(new URL('dados/indice.json', app), JSON.stringify(indice, null, 1));
for (const [nome, conteudo] of Object.entries(porDep)) writeFileSync(new URL('dados/' + nome, app), JSON.stringify(conteudo));
const quandoTxt = indice.checadoEm;
// Reserva enxuta: as checadas + as 300 não checadas com maior desconto anunciado (o resto vem de dados/ sob demanda).
const reserva = json.ofertas.filter((o) => o.classe !== 'nao_checado')
  .concat(json.ofertas.filter((o) => o.classe === 'nao_checado').sort((a, b) => (b.anunciado || 0) - (a.anunciado || 0)).slice(0, 300));
writeFileSync(new URL('ofertas-ml.js', app),
  `// GERADO por robo-da-black-coletor/scripts/gerar-ofertas-app.js em ${indice.geradoEm}. Não editar à mão.\n` +
  `// Reserva para quando dados/indice.json não carregar: ${reserva.length} de ${json.total} ofertas (checadas + 300 com maior desconto anunciado).\n` +
  `window.RB_COLETADO_EM = ${JSON.stringify(quandoTxt)};\nwindow.RB_INDICE_LOCAL = ${JSON.stringify({ total: indice.total, checadas: indice.checadas, lojas: indice.lojas, monitorados: indice.monitorados, lojasMonitoradas: indice.lojasMonitoradas })};\n` +
  `window.RB_OFERTAS = ${JSON.stringify(reserva)};\n`);
console.log(`monitorados: ${indice.monitorados} em ${indice.lojasMonitoradas.join(', ')} · vitrine: ${indice.total} (${indice.checadas} checadas) · classes:`, indice.porClasse);
console.log(`departamentos: ${Object.keys(porDep).length} → ../robo-da-black/dados/ · reserva ofertas-ml.js com ${reserva.length} ofertas`);

// App Ofertas do Telegram (robo-da-black-telegram): gera e publica na Vercel em segundo plano, só se as ofertas mudaram.
// Log em ../robo-da-black-telegram/publicar.log. Para não publicar nesta rodada: SEM_TELEGRAM=1 node scripts/gerar-ofertas-app.js
{
  const { spawn } = await import('node:child_process');
  const { existsSync, openSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const pasta = fileURLToPath(new URL('../../robo-da-black-telegram/', import.meta.url));
  if (!process.env.SEM_TELEGRAM && existsSync(pasta + 'publicar.sh')) {
    const log = openSync(pasta + 'publicar.log', 'a');
    spawn('bash', [pasta + 'publicar.sh'], { detached: true, stdio: ['ignore', log, log], env: { ...process.env, PULAR_ESPERA: '1' } }).unref();
    console.log('Telegram: atualizando o app Ofertas em segundo plano (log em robo-da-black-telegram/publicar.log)');
  }
}
