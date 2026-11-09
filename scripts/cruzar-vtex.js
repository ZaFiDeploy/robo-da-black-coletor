// Busca cruzada: procura as ofertas da vitrine (as que anunciam "de") em OUTRA loja VTEX com catálogo público
// e grava os pares em amostras/cruzado-<loja>-<AAAA-MM-DD>.json (um item por oferta nossa: { url, outra: {loja, preco, de, url, ean...} }).
// O gerar-ofertas-app.js lê esses arquivos e entrega o preço da outra loja ao motor (comparacao.outras).
//
// Uso: node scripts/cruzar-vtex.js --loja americanas [--limite 600] [--tudo] [--so-ean] [--lojas-origem "KaBuM!,Polishop"]
// Medido em 08/11: na Americanas a busca por TEXTO dos produtos do KaBuM! devolve quase só item sem estoque (AvailableQuantity 0) → use --so-ean.
// Robô educado: robots.txt, UA honesto, 1 pedido / 1,5 s, para no 1º 403/429/503. Grava aos poucos (pode interromper).
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { cruzar, LOJAS } from '../src/fontes/vtex-busca.js';
import { eanValido } from '../src/normalizar.js';
import { idDoLink } from '../src/links.js';

const { values: a } = parseArgs({ options: {
  loja: { type: 'string', default: 'americanas' },
  limite: { type: 'string', default: '600' },
  'so-vitrine': { type: 'boolean', default: true },
  'lojas-origem': { type: 'string' },
  tudo: { type: 'boolean', default: false },     // também as ofertas sem "de" (preço de catálogo): servem de comparação
  'so-ean': { type: 'boolean', default: false }  // só busca exata por EAN (sem busca por texto)
} });
if (!LOJAS[a.loja]) { console.error(`loja desconhecida: ${a.loja}. Opções: ${Object.keys(LOJAS).join(', ')}`); process.exit(1); }

const dir = new URL('../amostras/', import.meta.url);
const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const destino = new URL(`cruzado-${a.loja}-${hoje}.json`, dir);

// nossas ofertas, sem repetir URL (mesma regra do gerar-ofertas-app.js)
const arquivos = readdirSync(dir).filter((n) => /^(ml-2026-|ml-ofertas-|.*-sitemap-).*\.json$/.test(n)).sort();
const cruas = [], vistas = new Set();
for (const n of arquivos) for (const o of JSON.parse(readFileSync(new URL(n, dir), 'utf8'))) {
  const k = idDoLink(o.url)?.chave || o.url;
  if (vistas.has(k)) continue; vistas.add(k); cruas.push(o);
}
// já cruzadas hoje nesta loja: não repetir o pedido
const anteriores = existsSync(destino) ? JSON.parse(readFileSync(destino, 'utf8')) : [];
const jaFeitas = new Set(anteriores.map((x) => x.url));
const origens = a['lojas-origem'] ? new Set(a['lojas-origem'].split(',').map((s) => s.trim().toLowerCase())) : null;

let fila = cruas.filter((o) => !jaFeitas.has(o.url) && o.loja.toLowerCase() !== LOJAS[a.loja].nome.toLowerCase());
if (origens) fila = fila.filter((o) => origens.has(o.loja.toLowerCase()));
if (a['so-vitrine'] && !a.tudo) fila = fila.filter((o) => o.de > o.preco);
if (a['so-ean']) fila = fila.filter((o) => eanValido(o.ean));
// ordem: primeiro quem tem EAN (busca exata), depois os maiores descontos anunciados (onde o veredito vale mais)
fila.sort((x, y) => (eanValido(y.ean) - eanValido(x.ean)) || ((1 - y.preco / y.de) - (1 - x.preco / x.de)));
console.log(`${LOJAS[a.loja].nome}: ${fila.length} ofertas na fila (${fila.filter((o) => eanValido(o.ean)).length} com EAN), limite ${a.limite}, ${anteriores.length} já feitas hoje → ${destino.pathname.split('/').pop()}`);

const achados = [...anteriores];
const gravar = () => writeFileSync(destino, JSON.stringify(achados, null, 1));
const hora = () => new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
await cruzar({
  loja: a.loja, ofertas: fila, limite: +a.limite,
  log: (m) => console.log(hora(), m),
  aoAchar: (item) => { achados.push(item); gravar(); console.log(hora(), `par (${item.por}): ${item.titulo.slice(0, 48)} · ${item.loja} R$${item.preco ?? ''} × ${item.outra.loja} R$${item.outra.preco}`); }
});
gravar();
console.log(`salvo ${achados.length} pares em amostras/${destino.pathname.split('/').pop()}`);
