// Webhook do Jackbot (Vercel Function). O Telegram chama esta URL a cada mensagem ou toque em botão.
// Variáveis: TELEGRAM_TOKEN, TELEGRAM_SECRET, APP_URL, FOTO_URL e onde guardar (BLOB_READ_WRITE_TOKEN, ou SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
import { responder } from '../bot/conversa.js';
import { criarLoja } from '../bot/escolher-loja.js';
import { criarTelegram } from '../bot/telegram.js';
import { idadeDominioDias } from '../src/rdap.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Jackbot no ar.');
  // Só aceita chamadas do Telegram (o segredo vai no setWebhook, ver bot/configurar.js).
  if (process.env.TELEGRAM_SECRET && req.headers['x-telegram-bot-api-secret-token'] !== process.env.TELEGRAM_SECRET) return res.status(401).end();
  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const chamadas = await responder(update, {
      loja: criarLoja(),
      ligarSemApp: true,
      env: { APP_URL: process.env.APP_URL, FOTO_URL: process.env.FOTO_URL },
      idade: (host) => idadeDominioDias(host)
    });
    await criarTelegram().executar(chamadas);
  } catch (e) {
    console.error('jackbot', e); // responde 200 mesmo assim: senão o Telegram reenvia a mesma mensagem sem parar
  }
  res.status(200).end();
}
