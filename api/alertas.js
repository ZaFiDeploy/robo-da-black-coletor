// Dispara os alertas do Jackbot. Chamado pelo publicar.sh do app Ofertas depois de cada coleta
// (cabeçalho x-segredo = TELEGRAM_SECRET) e pelo cron diário da Vercel (Authorization: Bearer CRON_SECRET).
import { enviarAlertas } from '../bot/enviar-alertas.js';
import { criarLoja } from '../bot/escolher-loja.js';
import { criarTelegram } from '../bot/telegram.js';

export default async function handler(req, res) {
  const s = process.env.TELEGRAM_SECRET, c = process.env.CRON_SECRET;
  const ok = (s && req.headers['x-segredo'] === s) || (c && req.headers.authorization === `Bearer ${c}`);
  if (!ok) return res.status(401).end();
  try {
    const r = await enviarAlertas({ loja: criarLoja(), telegram: criarTelegram(), log: (t) => console.log(t) });
    res.status(200).json(r);
  } catch (e) {
    console.error('alertas', e);
    res.status(500).json({ erro: e.message });
  }
}
