// Sondagem educada: para cada site, lê robots.txt, acha o sitemap de produtos e abre UMA página de produto
// para ver se há JSON-LD com preço. No máximo 4 pedidos por site, 2 s entre eles, identidade honesta.
// Uso: node scripts/sondar-sites.js sites.txt > relatorio.json
import { readFileSync } from 'node:fs';
import { UA, lerRobots, permitido, grupoPara } from '../src/robots.js';
import { produtoDoJsonLd } from '../src/jsonld.js';

const sites = readFileSync(process.argv[2], 'utf8').split(/\s+/).filter(Boolean);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const cab = { 'user-agent': UA, accept: 'text/html,application/xml;q=0.9,*/*;q=0.5', 'accept-language': 'pt-BR,pt;q=0.9' };
const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);

async function pega(url) {
  try {
    const r = await fetch(url, { headers: cab, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    return { status: r.status, texto: r.status === 200 ? await r.text() : '', url: r.url };
  } catch (e) { return { status: 'erro', texto: '', erro: e.message }; }
}

async function sondar(host) {
  const origem = 'https://' + host, r = { host };
  const rb = await pega(origem + '/robots.txt');
  r.robots = rb.status;
  if (rb.status !== 200 && rb.status !== 404) return { ...r, veredito: 'robots não lido (' + rb.status + ')' };
  const grupos = rb.status === 404 ? [] : lerRobots(rb.texto);
  const g = grupoPara(grupos);
  r.delay = g?.delay ?? null;
  r.proibeTudo = g ? !permitido(grupos, '/qualquer-produto-p') && !permitido(grupos, '/produto/1') : false;
  const sitemaps = (rb.texto.match(/^sitemap:\s*(\S+)/gim) || []).map((l) => l.replace(/^sitemap:\s*/i, '')).slice(0, 3);
  if (!sitemaps.length) sitemaps.push(origem + '/sitemap.xml');
  await pausa(2000);
  let urls = [], sub = null;
  for (const sm of sitemaps.slice(0, 1)) {
    const x = await pega(sm); r.sitemap = x.status;
    if (x.status !== 200) continue;
    const l = locs(x.texto);
    const prod = l.filter((u) => /product|produto/i.test(u));
    if (l.some((u) => u.endsWith('.xml') || u.endsWith('.xml.gz'))) {
      sub = prod.find((u) => /\.xml(\.gz)?$/.test(u)) || l.find((u) => /\.xml(\.gz)?$/.test(u));
      r.subsitemaps = l.length;
      if (sub && !sub.endsWith('.gz')) { await pausa(2000); const y = await pega(sub); if (y.status === 200) urls = locs(y.texto); }
    } else urls = l;
  }
  r.urlsNoSitemap = urls.length;
  const candidata = urls.find((u) => /\/p$|\/p\/|\/produto\/|\/product\/|\/dp\//i.test(u)) || urls[0];
  if (!candidata) return { ...r, veredito: 'sem URL de produto no sitemap' };
  const caminho = new URL(candidata).pathname;
  r.exemplo = candidata.slice(0, 110);
  r.permitido = permitido(grupos, caminho);
  if (!r.permitido) return { ...r, veredito: 'robots proíbe a página de produto' };
  await pausa(2000);
  const pg = await pega(candidata);
  r.pagina = pg.status;
  if (pg.status !== 200) return { ...r, veredito: 'página respondeu ' + pg.status + (pg.erro ? ' ' + pg.erro : '') };
  const bloqueio = /captcha|radware|access denied|cloudflare|verifica[çc][ãa]o de seguran/i.test(pg.texto.slice(0, 5000)) && !/ld\+json/.test(pg.texto);
  if (bloqueio) return { ...r, veredito: 'página com bloqueio (captcha)' };
  const p = produtoDoJsonLd(pg.texto);
  r.jsonld = !!p; r.preco = p?.preco ?? null; r.ean = !!p?.ean; r.de = !!p?.de; r.titulo = p?.titulo?.slice(0, 50) ?? null;
  r.veredito = p ? 'OK: JSON-LD com preço' + (p.ean ? ' + EAN' : '') + (p.de ? ' + de' : '') : (/ld\+json/.test(pg.texto) ? 'JSON-LD sem preço (sem estoque ou outro formato)' : 'sem JSON-LD');
  return r;
}

const resultados = await Promise.all(sites.map((s) => sondar(s).catch((e) => ({ host: s, veredito: 'erro ' + e.message }))));
console.log(JSON.stringify(resultados, null, 1));
