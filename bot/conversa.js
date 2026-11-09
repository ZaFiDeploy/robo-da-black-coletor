// Cérebro do Jackbot no Telegram. Recebe um "update" do Telegram e devolve as chamadas da API a fazer.
// Não fala com a rede nem com o banco direto: usa a "loja" (memória nos testes, Supabase na produção).
// As regras de preço e de segurança são as MESMAS do motor (src/), nada copiado.

import { idDoLink } from '../src/links.js';
import { compararAntesDepois } from '../src/antes-depois.js';
import { scoreSeguranca, analisarUrl } from '../src/score.js';
import { T, teclado, SUGESTOES, AVISOS, avisoAtual, esc, reais } from './textos.js';

const msg = (chat_id, text, reply_markup) => ({ metodo: 'sendMessage', params: { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) } });
const editar = (chat_id, message_id, text, reply_markup) => ({ metodo: 'editMessageText', params: { chat_id, message_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) } });
const foto = (chat_id, photo, caption, reply_markup) => ({ metodo: 'sendPhoto', params: { chat_id, photo, caption, parse_mode: 'HTML', ...(reply_markup ? { reply_markup } : {}) } });
const okCallback = (callback_query_id, text) => ({ metodo: 'answerCallbackQuery', params: { callback_query_id, ...(text ? { text } : {}) } });

const FAIXA = { seguro: '🟢', atencao: '🟡', cuidado: '🟠', evite: '🔴' };
const VEREDITO = {
  caiu: '✅ <b>Desconto de verdade</b>',
  igual: '➖ <b>Sem desconto real</b>',
  subiu: '📈 <b>Mais caro que antes</b>',
  maquiagem: '🚨 <b>Black Fraude</b>',
  sem_historico: '⏳ <b>Vigiando</b>'
};

/**
 * @param {object} update  update do Telegram (message ou callback_query)
 * @param {object} ctx     { loja, env: { APP_URL, FOTO_URL }, agora?, idade?: (host) => Promise<dias> }
 * @returns {Promise<Array<{metodo, params}>>}
 */
export async function responder(update, ctx) {
  const { loja } = ctx;
  const agora = ctx.agora || new Date();

  // ---------- Botões ----------
  if (update.callback_query) {
    const q = update.callback_query, chat = q.message.chat.id, mid = q.message.message_id, data = q.data || '';
    const a = await loja.assinantePorChat(chat);
    if (!a) return [okCallback(q.id), msg(chat, T.semVinculo, teclado.abrirApp(ctx.env?.APP_URL))];
    const alvo = await loja.alvo(a.id);
    const out = [okCallback(q.id)];

    if (data === 'menu') out.push(editar(chat, mid, T.menu, teclado.menu()));
    else if (data === 'vigiar') out.push(editar(chat, mid, await textoLista(loja, a, alvo), teclado.lista(alvo.termos, await loja.vigiados(a.id))));
    else if (data === 'sugestoes') out.push(editar(chat, mid, T.primeiroAlvo, teclado.sugestoes(alvo.termos)));
    else if (data === 'checar') out.push(msg(chat, T.pedirLink));
    else if (data === 'relampago') out.push(...(await relampago(loja, chat)));
    else if (data === 'ajustes') out.push(editar(chat, mid, textoAjustes(a, alvo), teclado.ajustes(estadoAjustes(a, alvo))));
    else if (data.startsWith('sug:')) {
      const s = SUGESTOES[+data.slice(4)];
      if (s) {
        const i = alvo.termos.findIndex((t) => t.toLowerCase() === s.toLowerCase());
        const termos = i >= 0 ? alvo.termos.filter((_, j) => j !== i) : [...alvo.termos, s];
        await loja.salvarAlvo(a.id, { termos });
        out.push(editar(chat, mid, T.primeiroAlvo, teclado.sugestoes(termos)));
      }
    } else if (data.startsWith('rm:')) {
      const termos = alvo.termos.filter((_, j) => j !== +data.slice(3));
      await loja.salvarAlvo(a.id, { termos });
      out.push(editar(chat, mid, await textoLista(loja, a, { ...alvo, termos }), teclado.lista(termos, await loja.vigiados(a.id))));
    } else if (data.startsWith('rmv:')) {
      await loja.pararVigiado(a.id, +data.slice(4));
      out.push(editar(chat, mid, await textoLista(loja, a, alvo), teclado.lista(alvo.termos, await loja.vigiados(a.id))));
    } else if (data.startsWith('av:') && AVISOS[data.slice(3)]) {
      await loja.salvarAlvo(a.id, { classes: AVISOS[data.slice(3)].classes });
      const novo = { ...alvo, classes: AVISOS[data.slice(3)].classes };
      out.push(editar(chat, mid, textoAjustes(a, novo), teclado.ajustes(estadoAjustes(a, novo))));
    } else if (data === 'noite' || data === 'pausa' || data === 'feed') {
      const campos = data === 'noite' ? { silencio_noite: !a.silencio_noite } : data === 'feed' ? { ofertas_do_dia: a.ofertas_do_dia === false } : { pausado: !a.pausado };
      await loja.atualizarAssinante(a.id, campos);
      const novoA = { ...a, ...campos };
      out.push(editar(chat, mid, textoAjustes(novoA, alvo), teclado.ajustes(estadoAjustes(novoA, alvo))));
    } else if (data === 'vg') {
      const ultimo = lerEstado(a).ultimoLink;
      if (ultimo) { await loja.vigiar(a, ultimo, null); out[0] = okCallback(q.id, '🔔 Vou vigiar esse preço'); }
    }
    return out;
  }

  // ---------- Mensagens ----------
  const m = update.message;
  if (!m || !m.chat) return [];
  const chat = m.chat.id, texto = String(m.text || '').trim();

  if (texto.startsWith('/start')) {
    const appId = texto.split(/\s+/)[1];
    let a = await loja.assinantePorChat(chat);
    if (appId) a = await loja.vincular(appId, chat, m.from?.first_name || '');
    // Entrou direto pelo Telegram (botão Ofertas, link t.me): liga pelo próprio chat, sem passar pelo app.
    if (!a && ctx.ligarSemApp) a = await loja.vincular('tg:' + chat, chat, m.from?.first_name || '');
    if (!a) return [msg(chat, T.semVinculo, teclado.abrirApp(ctx.env?.APP_URL))];
    const alvo = await loja.alvo(a.id);
    const ola = T.boasVindas(m.from?.first_name);
    const saida = [ctx.env?.FOTO_URL ? foto(chat, ctx.env.FOTO_URL, ola) : msg(chat, ola)];
    saida.push(alvo.termos.length ? msg(chat, T.menu, teclado.menu()) : msg(chat, T.primeiroAlvo, teclado.sugestoes(alvo.termos)));
    return saida;
  }

  const a = await loja.assinantePorChat(chat);
  if (!a) return [msg(chat, T.semVinculo, teclado.abrirApp(ctx.env?.APP_URL))];
  const alvo = await loja.alvo(a.id);
  const cmd = texto.split(/[\s@]/)[0].toLowerCase();

  if (cmd === '/menu') return [msg(chat, T.menu, teclado.menu())];
  if (cmd === '/ajuda' || cmd === '/help') return [msg(chat, T.ajuda, teclado.menu())];
  if (cmd === '/vigiar') return [msg(chat, await textoLista(loja, a, alvo), teclado.lista(alvo.termos, await loja.vigiados(a.id)))];
  if (cmd === '/checar') return [msg(chat, T.pedirLink)];
  if (cmd === '/relampago') return relampago(loja, chat);
  if (cmd === '/ajustes') return [msg(chat, textoAjustes(a, alvo), teclado.ajustes(estadoAjustes(a, alvo)))];
  if (cmd === '/pausar') { await loja.atualizarAssinante(a.id, { pausado: true }); return [msg(chat, T.pausado, teclado.ajustes(estadoAjustes({ ...a, pausado: true }, alvo)))]; }
  if (cmd === '/voltar') { await loja.atualizarAssinante(a.id, { pausado: false }); return [msg(chat, T.voltou, teclado.menu())]; }
  if (cmd.startsWith('/')) return [msg(chat, T.ajuda, teclado.menu())];

  // Link → Caça Black Fraude
  if (/https?:\/\/|www\.|\.com(\.br)?\b/i.test(texto)) return checar(texto, a, ctx, chat, agora);

  // Nome de produto → vira alvo
  if (texto.length < 2 || texto.length > 40) return [msg(chat, T.nomeLongo)];
  const nome = texto.replace(/\s+/g, ' ');
  if (alvo.termos.some((t) => t.toLowerCase() === nome.toLowerCase())) return [msg(chat, T.jaTinha(nome), teclado.menu())];
  const termos = [...alvo.termos, nome];
  await loja.salvarAlvo(a.id, { termos });
  return [msg(chat, T.anotado(nome), teclado.desfazer(termos.length - 1))];
}

// ---------- Caça Black Fraude pelo Telegram ----------
async function checar(texto, a, ctx, chat, agora) {
  const { loja } = ctx;
  const id = idDoLink(texto);
  if (!id) return [msg(chat, T.linkInvalido)];
  if (id.tipo === 'encurtado') return [msg(chat, T.linkEncurtado)];

  const prod = id.loja === 'outra' ? null : await loja.produtoDoLink(id);
  const sinais = { url: id.url };
  if (prod?.lojaOficial) sinais.lojaOficial = true;
  if (prod?.reputacao) sinais.reputacao = prod.reputacao;
  if (prod?.realVsMercado != null) sinais.realVsMercado = prod.realVsMercado;
  if (id.loja === 'outra' && ctx.idade) {
    try { sinais.idadeDominioDias = await ctx.idade(new URL(id.url).hostname); } catch { /* sem RDAP: pesa como desconhecida */ }
  }
  const s = scoreSeguranca(sinais);
  const url = analisarUrl(id.url);
  const semVendedor = url.loja && url.marketplace && !prod?.reputacao && !prod?.lojaOficial && !s.motivos.some((x) => x.startsWith('-'));
  const linhaScore = semVendedor
    ? `🟢 Site oficial ${esc(url.loja)} · confira a reputação do vendedor antes de pagar`
    : `${FAIXA[s.faixa]} Segurança <b>${s.score}/100</b> · ${s.faixaNome}`;
  const riscos = s.motivos.filter((x) => x.startsWith('-')).map((x) => '• ' + esc(x.replace(/^-\d+\s*/, ''))).slice(0, 4);

  await loja.atualizarAssinante(a.id, { estado: JSON.stringify({ ...lerEstado(a), ultimoLink: id }) });

  if (id.loja === 'outra') {
    const corpo = [`🛡️ <b>Checagem do site</b>`, esc(new URL(id.url).hostname), '', linhaScore, ...riscos,
      '', s.score >= 60 ? 'Mesmo assim, compare o preço antes de pagar.' : 'Eu não compraria aqui. Se for comprar, pague com cartão, nunca Pix.'];
    return [msg(chat, corpo.join('\n'), teclado.checado(id.url, false))];
  }

  if (!prod || !prod.historico?.length) {
    await loja.vigiar(a, id, prod?.preco ?? null);
    const corpo = ['⏳ <b>Anotado!</b>', ...(prod?.nome ? [esc(prod.nome)] : []),
      'Ainda não tenho o histórico desse produto. Vou vigiar o preço todo dia e, em 5 dias, te mostro o antes e o agora.', '', linhaScore];
    return [msg(chat, corpo.join('\n'), teclado.checado(id.url, false))];
  }

  const r = compararAntesDepois({ historico: prod.historico, precoAgora: prod.preco, de: prod.de, agora });
  const corpo = [VEREDITO[r.veredito] || '', esc(prod.nome), `<b>${reais(prod.preco)}</b>${prod.de > prod.preco ? ` · loja diz <s>${reais(prod.de)}</s>` : ''}`, '', esc(r.frase), '', linhaScore, ...riscos];
  return [msg(chat, corpo.join('\n'), teclado.checado(id.url, true))];
}

// ---------- Telas ----------
async function textoLista(loja, a, alvo) {
  const vig = await loja.vigiados(a.id);
  if (!alvo.termos.length && !vig.length) return '<b>Ainda não estou vigiando nada.</b>\n\nEscreva o nome de um produto ou toque em <b>Sugestões</b>.';
  const linhas = ['🎯 <b>Estou vigiando</b>', ''];
  alvo.termos.forEach((t) => linhas.push('• ' + esc(t)));
  vig.forEach((v) => linhas.push('• ' + esc(v.nome || v.loja) + ' <i>(link)</i>'));
  linhas.push('', `🔔 ${AVISOS[avisoAtual(alvo.classes)].nome}${alvo.orcamento ? ' · até ' + reais(alvo.orcamento) : ''}`);
  if (a.pausado) linhas.push('⏸ Alertas pausados');
  linhas.push('', 'Para adicionar, escreva o nome do produto. Toque num item para tirar.');
  return linhas.join('\n');
}
function estadoAjustes(a, alvo) { return { aviso: avisoAtual(alvo.classes), silencio: a.silencio_noite !== false, pausado: !!a.pausado, feed: a.ofertas_do_dia !== false }; }
function textoAjustes(a, alvo) {
  const e = estadoAjustes(a, alvo);
  return ['⚙️ <b>Ajustes</b>', '', '<b>Quando te aviso</b>', AVISOS[e.aviso].nome + ' · ' + AVISOS[e.aviso].sub, '',
    e.feed ? '🔥 Ofertas do dia: mando as melhores com desconto de verdade, 2 vezes por dia.' : '🔥 Ofertas do dia: desligadas (só aviso o que você vigia).',
    e.silencio ? '🌙 Entre 22h e 8h só mando as imperdíveis.' : '🌙 Aviso a qualquer hora.', e.pausado ? '⏸ Alertas pausados.' : ''].join('\n').trim();
}
async function relampago(loja, chat) {
  const lista = await loja.relampagoHoje();
  if (!lista.length) return [msg(chat, T.semRelampago, teclado.voltar())];
  const itens = lista.slice(0, 5).map((o, i) => `${i + 1}. <a href="${esc(o.url)}">${esc(o.nome)}</a>\n<b>${reais(o.preco)}</b> · -${Math.round(o.real * 100)}% de verdade · ${esc(o.loja)}`);
  return [msg(chat, '⚡ <b>Relâmpago de hoje</b>\nAs maiores quedas reais do momento.\n\n' + itens.join('\n\n'), teclado.voltar())];
}
function lerEstado(a) { try { return JSON.parse(a.estado || '{}') || {}; } catch { return {}; } }
