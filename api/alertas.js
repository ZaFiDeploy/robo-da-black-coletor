// Dispara os alertas do Jackbot e os posts do canal de ofertas (CANAL_ID). Chamado pelo publicar.sh do app Ofertas depois de cada coleta
// (cabeçalho x-segredo = TELEGRAM_SECRET) e pelo cron diário da Vercel (Authorization: Bearer CRON_SECRET).
import { enviarAlertas } from '../bot/enviar-alertas.js';
import { criarLoja } from '../bot/escolher-loja.js';
import { criarTelegram } from '../bot/telegram.js';
import { postarNoCanal } from '../bot/canal.js';

export default async function handler(req, res) {
  const s = process.env.TELEGRAM_SECRET, c = process.env.CRON_SECRET;
  const ok = (s && req.headers['x-segredo'] === s) || (c && req.headers.authorization === `Bearer ${c}`);
  if (!ok) return res.status(401).end();
  try {
    const loja = criarLoja(), telegram = criarTelegram(), log = (t) => console.log(t);
    const alertas = await enviarAlertas({ loja, telegram, log });
    const canal = loja.ofertasCanal ? await postarNoCanal({ loja, telegram, log }) : { postados: 0 };
    res.status(200).json({ alertas, canal });
  } catch (e) {
    console.error('alertas', e);
    res.status(500).json({ erro: e.message });
  }
}
