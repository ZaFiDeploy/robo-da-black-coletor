// "Loja" do bot no Vercel Blob PRIVADO (mesma interface da loja-memoria e da loja-supabase).
// Usada enquanto o Robô da Black não tem Supabase próprio. Um arquivo JSON por conversa:
//   bot/c/<chat>.json = { assinante, alvo, vigiados, alertas }
// As ofertas vêm do app Ofertas do Telegram já publicado (OFERTAS_URL), que é gerado a cada coleta.
// Variáveis: BLOB_READ_WRITE_TOKEN (a Vercel põe sozinha ao ligar o store), OFERTAS_URL (opcional).
import { put, get, list } from '@vercel/blob';
import { idDoLink } from '../src/links.js';
import { comAfiliado } from '../src/afiliado.js';

// Duas fontes das ofertas: a coleta diária do GitHub e a cópia publicada no app Ofertas. Vale a mais nova.
const FONTES = process.env.OFERTAS_URL ? [process.env.OFERTAS_URL] : ['https://raw.githubusercontent.com/ZaFiDeploy/robo-da-black-coletor/main/publico/telegram/', 'https://robo-da-black-telegram.vercel.app/dados/'];
const ALVO_PADRAO = { termos: [], classes: ['imperdivel', 'otimo'], orcamento: null, cats: [] };
const DIAS_ALERTAS = 7;
const caminho = (chat) => `bot/c/${chat}.json`;

async function lerJSON(pathname, b) {
  const r = await b.get(pathname, { access: 'private', useCache: false });
  if (!r || !r.stream) return null;
  return JSON.parse(await new Response(r.stream).text());
}

export function criarLojaBlob({ blob = { put, get, list }, fetchFn = fetch, fontes = FONTES } = {}) {
  const cache = new Map(); // chat → ficha (vale para uma execução da função)
  let ofertasCache = null;

  async function ficha(chat) {
    if (cache.has(chat)) return cache.get(chat);
    const f = await lerJSON(caminho(chat), blob);
    if (f) cache.set(chat, f);
    return f;
  }
  async function salvar(f) {
    const corte = Date.now() - DIAS_ALERTAS * 86400000;
    f.alertas = (f.alertas || []).filter((x) => Date.parse(x.enviado_em) >= corte);
    cache.set(f.assinante.id, f);
    await blob.put(caminho(f.assinante.id), JSON.stringify(f), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
  }
  async function ofertas() {
    if (ofertasCache) return ofertasCache;
    const pegar = async (u) => { const r = await fetchFn(u, { cache: 'no-store' }); if (!r.ok) throw new Error(`ofertas ${u}: ${r.status}`); return r.json(); };
    const lidas = await Promise.all(fontes.map((base) => pegar(base + 'destaques.json').then((d) => ({ base, d }), () => null)));
    const melhor = lidas.filter(Boolean).sort((a, b) => (Date.parse(b.d.resumo?.geradoEm) || 0) - (Date.parse(a.d.resumo?.geradoEm) || 0))[0];
    if (!melhor) throw new Error('nenhuma fonte de ofertas respondeu');
    ofertasCache = { todas: await pegar(melhor.base + 'todas.json'), destaques: melhor.d };
    return ofertasCache;
  }
  const chaveDe = (o) => idDoLink(o.url)?.chave || String(o.id);

  return {
    async assinantePorChat(chat) { return (await ficha(chat))?.assinante || null; },
    async vincular(appId, chat, nome) {
      const f = (await ficha(chat)) || { assinante: { id: chat, plano: 'completo', pausado: false, silencio_noite: true, criado_em: new Date().toISOString() }, alvo: { ...ALVO_PADRAO }, vigiados: [], alertas: [] };
      Object.assign(f.assinante, { app_id: appId, telegram_chat_id: chat, nome: nome || f.assinante.nome || '', ativo: true });
      await salvar(f);
      return f.assinante;
    },
    async atualizarAssinante(id, campos) {
      const f = await ficha(id); if (!f) return;
      Object.assign(f.assinante, campos); await salvar(f);
    },
    async alvo(id) { return { ...ALVO_PADRAO, ...((await ficha(id))?.alvo || {}) }; },
    async salvarAlvo(id, campos) {
      const f = await ficha(id); if (!f) return;
      f.alvo = { ...ALVO_PADRAO, ...(f.alvo || {}), ...campos }; await salvar(f);
    },
    async vigiar(a, link, precoInicial) {
      const f = await ficha(a.id); if (!f) return;
      if (f.vigiados.some((v) => v.loja === link.loja && v.id_loja === link.id && v.ativo)) return;
      const p = await this.produtoDoLink(link);
      const vid = f.vigiados.reduce((m, v) => Math.max(m, v.id), 0) + 1;
      f.vigiados.push({ id: vid, loja: link.loja, id_loja: link.id, url: link.url, nome: p?.nome || null, preco_inicial: precoInicial ?? null, ativo: true, em: new Date().toISOString() });
      await salvar(f);
    },
    async vigiados(id) { return ((await ficha(id))?.vigiados || []).filter((v) => v.ativo); },
    async pararVigiado(id, vid) {
      const f = await ficha(id); const v = f?.vigiados.find((x) => x.id === vid);
      if (v) { v.ativo = false; await salvar(f); }
    },
    async produtoDoLink(link) {
      const { todas } = await ofertas();
      const o = todas.find((x) => chaveDe(x) === link.chave || x.url === link.url);
      if (!o) return null;
      // Sem histórico guardado por produto ainda: o veredito vem do motor (real vs. mercado no dia).
      return { nome: o.nome, preco: o.preco, de: o.de ?? null, realVsMercado: o.real ?? null, historico: [] };
    },
    async relampagoHoje() {
      const { destaques } = await ofertas();
      return (destaques.relampago || []).map((o) => ({ nome: o.nome, preco: o.preco, real: o.real, loja: o.loja, url: comAfiliado(o.url) }));
    },
    // ---------- envio de alertas ----------
    async assinantesAtivos() {
      const fichas = [];
      let cursor;
      do {
        const r = await blob.list({ prefix: 'bot/c/', cursor, limit: 1000 });
        for (const b of r.blobs) {
          const f = await lerJSON(b.pathname, blob);
          if (f?.assinante) { cache.set(f.assinante.id, f); fichas.push(f); }
        }
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor);
      return fichas.map((f) => f.assinante).filter((a) => a.telegram_chat_id && !a.pausado && a.ativo !== false);
    },
    async ofertasAtuais() {
      const { todas } = await ofertas();
      return todas.filter((o) => ['imperdivel', 'otimo', 'bom'].includes(o.classe)).map((o) => ({
        chave: chaveDe(o), nome: o.nome, cat: o.top, loja: o.loja, url: comAfiliado(o.url), preco: o.preco,
        referencia: o.mercado ?? o.de, real: o.real, classe: o.classe, score: o.score, menorEm90: !!o.menorEm90
      }));
    },
    // ---------- canal de ofertas ----------
    async ofertasCanal() {
      const { todas } = await ofertas();
      return todas.filter((o) => ['imperdivel', 'otimo', 'bom', 'falso'].includes(o.classe)).map((o) => ({
        chave: chaveDe(o), nome: o.nome, loja: o.loja, url: o.url, img: o.img, preco: o.preco, de: o.de,
        referencia: o.mercado, real: o.real, classe: o.classe, score: o.score, menorEm90: !!o.menorEm90, relampago: !!o.relampago
      }));
    },
    async feedPostados(id) { return (await ficha(id))?.feed || []; },
    async registrarFeed(id, lista) {
      const f = await ficha(id); if (!f) return;
      const corte = Date.now() - 7 * 86400000;
      f.feed = (f.feed || []).filter((x) => Date.parse(x.em) >= Math.min(corte, Date.parse(lista[0]?.em) - 7 * 86400000)).concat(lista);
      await salvar(f);
    },
    async canalPostados() { return (await lerJSON('bot/canal.json', blob))?.postados || []; },
    async registrarCanal(p) {
      const corte = Date.parse(p.em) - 7 * 86400000;
      const postados = (await this.canalPostados()).filter((x) => Date.parse(x.em) >= corte).concat(p);
      await blob.put('bot/canal.json', JSON.stringify({ postados }), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
    },
    async alertasEnviados(desdeISO) {
      const desde = Date.parse(desdeISO);
      return [...cache.values()].flatMap((f) => (f.alertas || []).filter((x) => Date.parse(x.enviado_em) >= desde).map((x) => ({ assinante_id: f.assinante.id, ...x })));
    },
    async registrarAlerta({ assinante_id, produto_chave, preco }) {
      const f = await ficha(assinante_id); if (!f) return;
      f.alertas = [...(f.alertas || []), { produto_chave, preco, enviado_em: new Date().toISOString() }];
      await salvar(f);
    }
  };
}
