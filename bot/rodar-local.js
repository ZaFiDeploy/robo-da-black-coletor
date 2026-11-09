// Jackbot de verdade no Telegram, rodando neste computador (para testar antes de ter banco e servidor).
// Lê as mensagens por "long polling" (sem webhook). Dados ficam em memória: somem quando você fecha.
//   TELEGRAM_TOKEN=... node bot/rodar-local.js
// Para testar a entrada pelo app, abra no celular: https://t.me/SEU_BOT?start=teste123
import { responder } from './conversa.js';
import { criarLojaMemoria } from './loja-memoria.js';
import { criarTelegram } from './telegram.js';
import { idadeDominioDias } from '../src/rdap.js';
import { COMANDOS, DESCRICAO_CURTA, DESCRICAO } from './textos.js';
import { fileURLToPath } from 'node:url';

const FOTO_LOCAL = fileURLToPath(new URL('../public/jackbot-ola.png', import.meta.url));

const tg = criarTelegram();
const loja = criarLojaMemoria();
const ctx = { loja, env: { APP_URL: process.env.APP_URL || 'https://robo-da-black.vercel.app', FOTO_URL: process.env.FOTO_URL || FOTO_LOCAL }, idade: (h) => idadeDominioDias(h) };

await tg.chamar('deleteWebhook', { drop_pending_updates: false }); // long polling não convive com webhook
const eu = await tg.chamar('getMe');
// Menu "/" e textos do perfil, para o teste ficar igual à produção.
await tg.chamar('setMyCommands', { commands: COMANDOS });
await tg.chamar('setMyShortDescription', { short_description: DESCRICAO_CURTA }).catch(() => {});
await tg.chamar('setMyDescription', { description: DESCRICAO }).catch(() => {});
console.log(`Jackbot rodando como @${eu.username}. Abra https://t.me/${eu.username}?start=teste123 no celular. Ctrl+C para parar.`);

let offset = 0;
for (;;) {
  try {
    const updates = await tg.chamar('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query'] });
    for (const u of updates) {
      offset = u.update_id + 1;
      const quem = u.message?.from?.first_name || u.callback_query?.from?.first_name || '?';
      console.log(`← ${quem}: ${u.message?.text ?? '[botão ' + u.callback_query?.data + ']'}`);
      try { await tg.executar(await responder(u, ctx)); } catch (e) { console.error('erro na resposta:', e.message); }
    }
  } catch (e) {
    console.error('conexão:', e.message); await new Promise((ok) => setTimeout(ok, 3000));
  }
}
