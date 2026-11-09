// Configura o Jackbot no Telegram (rodar 1 vez, depois de criar o bot no BotFather e publicar o webhook).
//   TELEGRAM_TOKEN=... TELEGRAM_SECRET=... WEBHOOK_URL=https://SEU-PROJETO.vercel.app/api/telegram node bot/configurar.js
// O token NÃO vai no código nem no chat: só na variável de ambiente.
import { criarTelegram } from './telegram.js';
import { COMANDOS, DESCRICAO_CURTA, DESCRICAO } from './textos.js';

const tg = criarTelegram();
const url = process.env.WEBHOOK_URL;
if (!url) throw new Error('Falta WEBHOOK_URL (ex.: https://robo-da-black-bot.vercel.app/api/telegram)');

await tg.chamar('setWebhook', { url, secret_token: process.env.TELEGRAM_SECRET, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
await tg.chamar('setMyCommands', { commands: COMANDOS });
await tg.chamar('setMyShortDescription', { short_description: DESCRICAO_CURTA });
await tg.chamar('setMyDescription', { description: DESCRICAO });
const info = await tg.chamar('getWebhookInfo');
console.log('Jackbot configurado. Webhook:', info.url, '| pendentes:', info.pending_update_count);
