import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarLojaBlob } from '../bot/loja-blob.js';
import { responder } from '../bot/conversa.js';
import { enviarAlertas } from '../bot/enviar-alertas.js';

// Blob falso em memória com a mesma forma do @vercel/blob (put/get/list).
function blobFalso() {
  const m = new Map();
  return {
    m,
    async put(p, corpo) { m.set(p, corpo); return { pathname: p }; },
    async get(p) { return m.has(p) ? { stream: new Response(m.get(p)).body } : null; },
    async list({ prefix }) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((pathname) => ({ pathname })), hasMore: false }; }
  };
}
const TODAS = [
  { id: 1, nome: 'Lava-roupas líquido Tixan Ypê 7 L', loja: 'Mercado Livre', preco: 47.49, de: 95, mercado: 83.78, url: 'https://www.mercadolivre.com.br/p/MLB19466433', classe: 'imperdivel', real: 0.433, score: 72, top: 'MLB1403', relampago: true },
  { id: 2, nome: 'Smart TV 50', loja: 'Mercado Livre', preco: 2215, de: 3424, url: 'https://www.mercadolivre.com.br/p/MLB74962073', classe: 'falso', real: 0.007, score: 72, top: 'MLB1000' }
];
const fetchFalso = async (url) => ({ ok: true, json: async () => (url.endsWith('todas.json') ? TODAS : { resumo: { geradoEm: '2026-11-08T00:00:00Z' }, relampago: [TODAS[0]] }) });
const nova = (blob) => criarLojaBlob({ blob, fetchFn: fetchFalso, fontes: ['https://x/'] });
const msg = (t) => ({ message: { chat: { id: 9 }, from: { first_name: 'Bia' }, text: t } });

test('loja Blob: /start liga, guarda o alvo e sobrevive a uma nova execução', async () => {
  const blob = blobFalso();
  await responder(msg('/start'), { loja: nova(blob), ligarSemApp: true, env: {} });
  await responder(msg('lava-roupas'), { loja: nova(blob), ligarSemApp: true, env: {} });
  const f = JSON.parse(blob.m.get('bot/c/9.json'));
  assert.equal(f.assinante.app_id, 'tg:9');
  assert.deepEqual(f.alvo.termos, ['lava-roupas']);
});

test('loja Blob: relâmpago e link vêm das ofertas publicadas', async () => {
  const loja = nova(blobFalso());
  assert.equal((await loja.relampagoHoje())[0].real, 0.433);
  const p = await loja.produtoDoLink({ chave: 'mercadolivre:MLB19466433', url: 'https://www.mercadolivre.com.br/p/MLB19466433' });
  assert.equal(p.realVsMercado, 0.433);
});

test('loja Blob: alerta sai só para quem vigia o termo e não repete', async () => {
  const blob = blobFalso();
  await responder(msg('/start'), { loja: nova(blob), ligarSemApp: true, env: {} });
  await responder(msg('tixan'), { loja: nova(blob), ligarSemApp: true, env: {} });
  const enviados = [];
  const telegram = { chamar: async (_m, p) => enviados.push(p) };
  const agora = new Date(); // o registro usa a hora real; a oferta é imperdível, então vale até de noite
  await enviarAlertas({ loja: nova(blob), telegram, agora, log: () => {} });
  await enviarAlertas({ loja: nova(blob), telegram, agora, log: () => {} });
  assert.equal(enviados.length, 1);
  assert.match(enviados[0].text, /Tixan/);
});

test('canal: posta as boas com desconto real e 1 fraude, sem repetir na rodada seguinte', async () => {
  const { postarNoCanal, textoCanal } = await import('../bot/canal.js');
  const blob = blobFalso();
  const posts = [];
  const telegram = { chamar: async (m, p) => posts.push({ m, p }) };
  const agora = new Date('2026-11-20T15:00:00-03:00');
  await postarNoCanal({ loja: nova(blob), telegram, canal: '@teste', agora, log: () => {} });
  assert.equal(posts.length, 2);
  assert.match(posts[0].p.text || posts[0].p.caption, /IMPERDÍVEL/);
  assert.match(posts[1].p.text || posts[1].p.caption, /BLACK FRAUDE/);
  await postarNoCanal({ loja: nova(blob), telegram, canal: '@teste', agora, log: () => {} });
  assert.equal(posts.length, 2, 'não repete');
  assert.equal((await postarNoCanal({ loja: nova(blob), telegram, canal: '@teste', agora: new Date('2026-11-20T02:00:00-03:00'), log: () => {} })).motivo, 'madrugada');
  assert.doesNotMatch(textoCanal({ classe: 'otimo', nome: '<x>', preco: 10, real: 0.2, loja: 'L' }), /<x>/);
});
