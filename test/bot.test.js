import { test } from 'node:test';
import assert from 'node:assert/strict';
import { responder } from '../bot/conversa.js';
import { criarLojaMemoria } from '../bot/loja-memoria.js';
import { enviarAlertas } from '../bot/enviar-alertas.js';

const CHAT = 77;
const novoCtx = () => ({ loja: criarLojaMemoria(), env: { APP_URL: 'https://app' }, idade: async () => 12 });
const texto = (ctx, t) => responder({ message: { chat: { id: CHAT }, from: { first_name: 'Ana' }, text: t } }, ctx);
const toque = (ctx, data) => responder({ callback_query: { id: 'q', data, message: { chat: { id: CHAT }, message_id: 5 } } }, ctx);
const textos = (r) => r.map((c) => c.params.text || c.params.caption || '').join('\n');

test('sem vínculo, o Jackbot manda ativar pelo app', async () => {
  const r = await texto(novoCtx(), 'oi');
  assert.match(textos(r), /Abrir no Telegram/);
  assert.equal(r[0].params.reply_markup.inline_keyboard[0][0].url, 'https://app');
});

test('/start sem id liga pelo próprio Telegram quando ligarSemApp', async () => {
  const ctx = { ...novoCtx(), ligarSemApp: true };
  const r = await texto(ctx, '/start');
  assert.match(textos(r), /O que você quer comprar/);
  assert.equal((await ctx.loja.assinantePorChat(CHAT)).app_id, 'tg:' + CHAT);
});

test('/start com o id do app vincula e pede o que vigiar', async () => {
  const ctx = novoCtx();
  const r = await texto(ctx, '/start app-1');
  assert.match(textos(r), /Eu sou o <b>Jackbot<\/b>/);
  assert.match(textos(r), /O que você quer comprar/);
  assert.ok(await ctx.loja.assinantePorChat(CHAT));
});

test('sugestão liga e desliga; nome escrito vira alvo', async () => {
  const ctx = novoCtx(); await texto(ctx, '/start app-1');
  await toque(ctx, 'sug:0');
  const a = await ctx.loja.assinantePorChat(CHAT);
  assert.deepEqual((await ctx.loja.alvo(a.id)).termos, ['Air fryer']);
  await toque(ctx, 'sug:0');
  assert.deepEqual((await ctx.loja.alvo(a.id)).termos, []);
  const r = await texto(ctx, 'iPhone 15');
  assert.match(textos(r), /Vou vigiar <b>iPhone 15<\/b>/);
  assert.match(textos(await texto(ctx, 'iphone 15')), /Já estou vigiando/);
});

test('link com histórico inflado = Black Fraude', async () => {
  const ctx = novoCtx(); await texto(ctx, '/start app-1');
  const r = await texto(ctx, 'olha https://www.mercadolivre.com.br/air/p/MLB99999999');
  assert.match(textos(r), /🚨 <b>Black Fraude<\/b>/);
  assert.match(textos(r), /Site oficial Mercado Livre/);
});

test('link de loja grande sem histórico: anota e passa a vigiar', async () => {
  const ctx = novoCtx(); await texto(ctx, '/start app-1');
  const r = await texto(ctx, 'https://www.mercadolivre.com.br/secadora/p/MLB24047848');
  assert.match(textos(r), /Anotado/);
  const a = await ctx.loja.assinantePorChat(CHAT);
  assert.equal((await ctx.loja.vigiados(a.id)).length, 1);
});

test('site que imita loja grande leva nota baixa e conselho de não comprar', async () => {
  const ctx = novoCtx(); await texto(ctx, '/start app-1');
  const r = await texto(ctx, 'https://ofertas-magalu-black.shop/produto/1');
  assert.match(textos(r), /🔴 Segurança <b>\d+\/100<\/b>/);
  assert.match(textos(r), /imita &quot;magalu&quot;/);
  assert.match(textos(r), /nunca Pix/);
});

test('relâmpago lista 5 e ajustes trocam quando avisar', async () => {
  const ctx = novoCtx(); await texto(ctx, '/start app-1');
  assert.equal((textos(await texto(ctx, '/relampago')).match(/de verdade/g) || []).length, 5);
  await toque(ctx, 'av:imperdivel');
  const a = await ctx.loja.assinantePorChat(CHAT);
  assert.deepEqual((await ctx.loja.alvo(a.id)).classes, ['imperdivel']);
  await toque(ctx, 'pausa');
  assert.equal((await ctx.loja.assinantePorChat(CHAT)).pausado, true);
});

test('alertas: de dia manda ótimo e imperdível; à noite só imperdível', async () => {
  const mk = async () => { const loja = criarLojaMemoria(); const a = await loja.vincular('app', 1, 'Ana'); await loja.salvarAlvo(a.id, { termos: ['secadora', 'inversor'] }); return loja; };
  const dia = await enviarAlertas({ loja: await mk(), telegram: null, agora: new Date('2026-11-20T15:00:00-03:00'), log: () => {} });
  assert.equal(dia.planejados, 2);
  const noite = await enviarAlertas({ loja: await mk(), telegram: null, agora: new Date('2026-11-20T23:30:00-03:00'), log: () => {} });
  assert.equal(noite.planejados, 1);
});
