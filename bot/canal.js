// Ofertas do Jackbot (como os canais de promoção): depois de cada coleta, manda direto para cada pessoa
// (enviarOfertasDoDia) e, se existir CANAL_ID, posta também num canal
// as melhores ofertas com desconto REAL e, de vez em quando, uma Black Fraude pega no flagra.
// Regras: até 6 posts por rodada, nada de madrugada (23h–7h), não repete a mesma oferta em 3 dias
// (só reposta se o preço cair mais 5%), loja com nota de segurança abaixo de 60 não entra.
// Precisa: CANAL_ID (ex.: @robodablack) e o @JackbotDaBlackBot como administrador do canal.
import { comAfiliado } from '../src/afiliado.js';
import { esc, reais } from './textos.js';

export const REGRAS_CANAL = { maxPorRodada: 6, fraudesPorRodada: 1, scoreMin: 60, diasSemRepetir: 3, novaQuedaMin: 0.05 };
const SELO = { imperdivel: '🔥 <b>IMPERDÍVEL</b>', otimo: '✅ <b>ÓTIMO PREÇO</b>', bom: '👍 <b>BOM PREÇO</b>' };
const pct = (x) => Math.round(x * 100) + '%';
const horaSP = (d) => +d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }) % 24;

export function textoCanal(o) {
  if (o.classe === 'falso') {
    return ['🚨 <b>BLACK FRAUDE</b>', `<b>${esc(o.nome)}</b>`, '',
      `A loja diz <s>${reais(o.de)}</s> → ${reais(o.preco)} (−${pct(1 - o.preco / o.de)})`,
      o.referencia ? `Mas o preço comum em outras lojas é <b>${reais(o.referencia)}</b>. O desconto de verdade é quase zero.` : 'Mas esse "de" não bate com o preço de verdade.',
      '', `🛒 ${esc(o.loja)}`, '', '<i>Checado pelo Jackbot · Robô da Black</i>'].join('\n');
  }
  return [`${SELO[o.classe] || '💸'} · <b>−${pct(o.real)} de verdade</b>`, `<b>${esc(o.nome)}</b>`, '',
    `${o.de && o.de > o.preco ? `❌ <s>${reais(o.de)}</s>  ` : ''}✅ <b>${reais(o.preco)}</b>`,
    o.referencia ? `📊 Preço comum em outras lojas: ${reais(o.referencia)}` : null,
    o.menorEm90 ? '📉 Menor preço dos últimos 90 dias' : null,
    `🛒 ${esc(o.loja)}${o.score != null ? ` · 🛡️ segurança ${o.score}/100` : ''}`,
    '', '<i>Checado pelo Jackbot · Robô da Black</i>'].filter((l) => l != null).join('\n');
}

/** Escolhe o que postar nesta rodada. */
export function planejarCanal(ofertas, postados = [], agora = new Date(), R = REGRAS_CANAL) {
  const corte = agora.getTime() - R.diasSemRepetir * 86400000;
  const recente = new Map(postados.filter((p) => Date.parse(p.em) >= corte).map((p) => [p.chave, p]));
  const pode = (o) => {
    if ((o.score ?? 0) < R.scoreMin || !o.url) return false;
    const p = recente.get(o.chave);
    return !p || o.preco <= p.preco * (1 - R.novaQuedaMin);
  };
  const RANK = { imperdivel: 0, otimo: 1, bom: 2 };
  const boas = ofertas.filter((o) => o.classe in RANK && o.real > 0 && pode(o))
    .sort((a, b) => (b.relampago ? 1 : 0) - (a.relampago ? 1 : 0) || RANK[a.classe] - RANK[b.classe] || b.real - a.real);
  const fraudes = ofertas.filter((o) => o.classe === 'falso' && o.de > o.preco && pode(o))
    .sort((a, b) => (1 - b.preco / b.de) - (1 - a.preco / a.de)).slice(0, R.fraudesPorRodada);
  return boas.slice(0, R.maxPorRodada - fraudes.length).concat(fraudes);
}

export async function postarNoCanal({ loja, telegram, canal = process.env.CANAL_ID, agora = new Date(), log = console.log }) {
  if (!canal) return { postados: 0, motivo: 'sem CANAL_ID' };
  const h = horaSP(agora);
  if (h >= 23 || h < 7) return { postados: 0, motivo: 'madrugada' };
  const plano = planejarCanal(await loja.ofertasCanal(), await loja.canalPostados(), agora);
  let ok = 0;
  for (const o of plano) {
    const teclado = { inline_keyboard: [[{ text: o.classe === 'falso' ? 'Ver na loja' : 'Ver oferta →', url: comAfiliado(o.url) }]] };
    try {
      const legenda = textoCanal(o);
      if (o.img) await telegram.chamar('sendPhoto', { chat_id: canal, photo: o.img, caption: legenda, parse_mode: 'HTML', reply_markup: teclado });
      else await telegram.chamar('sendMessage', { chat_id: canal, text: legenda, parse_mode: 'HTML', reply_markup: teclado, disable_web_page_preview: true });
      await loja.registrarCanal({ chave: o.chave, preco: o.preco, em: agora.toISOString() });
      ok++;
    } catch (e) { log(`canal: falhou ${o.chave}: ${e.message}`); }
  }
  log(`Canal ${canal}: ${ok} de ${plano.length} postados.`);
  return { postados: ok, planejados: plano.length };
}

// ---------- Ofertas do dia, direto na conversa de cada pessoa ----------
export const REGRAS_FEED = { ...REGRAS_CANAL, maxPorRodada: 3, fraudesPorRodada: 1 };

export async function enviarOfertasDoDia({ loja, telegram, agora = new Date(), log = console.log, R = REGRAS_FEED }) {
  const h = horaSP(agora);
  if (h >= 22 || h < 8) return { pessoas: 0, enviados: 0, motivo: 'noite' };
  const pessoas = (await loja.assinantesAtivos()).filter((a) => a.ofertas_do_dia !== false);
  const ofertas = await loja.ofertasCanal();
  let enviados = 0;
  for (const a of pessoas) {
    // não repete o que já foi como alerta nem como oferta do dia
    const ja = [...(await loja.feedPostados(a.id)), ...(await loja.alertasEnviados(new Date(agora.getTime() - R.diasSemRepetir * 86400000).toISOString()))
      .filter((x) => x.assinante_id === a.id).map((x) => ({ chave: x.produto_chave, preco: +x.preco, em: x.enviado_em }))];
    const plano = planejarCanal(ofertas, ja, agora, R);
    if (!plano.length) continue;
    try {
      await telegram.chamar('sendMessage', { chat_id: a.telegram_chat_id, parse_mode: 'HTML', text: '🎰 <b>Ofertas do dia</b> · checadas pelo Jackbot' });
      for (const o of plano) {
        const teclado = { inline_keyboard: [[{ text: o.classe === 'falso' ? 'Ver na loja' : 'Ver oferta →', url: comAfiliado(o.url) }]] };
        const legenda = textoCanal(o);
        if (o.img) await telegram.chamar('sendPhoto', { chat_id: a.telegram_chat_id, photo: o.img, caption: legenda, parse_mode: 'HTML', reply_markup: teclado });
        else await telegram.chamar('sendMessage', { chat_id: a.telegram_chat_id, text: legenda, parse_mode: 'HTML', reply_markup: teclado, disable_web_page_preview: true });
        enviados++;
      }
      await loja.registrarFeed(a.id, plano.map((o) => ({ chave: o.chave, preco: o.preco, em: agora.toISOString() })));
    } catch (e) {
      log(`ofertas do dia: falhou para ${a.id}: ${e.message}`);
      if (e.codigo === 403) await loja.atualizarAssinante(a.id, { telegram_chat_id: null }); // bloqueou o bot
    }
  }
  log(`Ofertas do dia: ${enviados} mensagens para ${pessoas.length} pessoas.`);
  return { pessoas: pessoas.length, enviados };
}
