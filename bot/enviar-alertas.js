// Envia os alertas do Jackbot depois de cada coleta (rodar no GitHub Actions, logo após o coletor).
//   node bot/enviar-alertas.js            → envia de verdade (precisa TELEGRAM_TOKEN + Supabase)
//   node bot/enviar-alertas.js --simular  → só mostra quem receberia o quê (dados de exemplo, sem enviar)
// Regras de quem recebe o quê: src/alerta.js (máx. 8 por pessoa por dia, reaviso só se cair mais 5%, score ≥ 60).
import { planejarAlertas } from '../src/alerta.js';
import { pathToFileURL } from 'node:url';

const NOITE = (agora) => { const h = +agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }) % 24; return h >= 22 || h < 8; };

export async function enviarAlertas({ loja, telegram, agora = new Date(), log = console.log }) {
  const assinantes = await loja.assinantesAtivos();
  const porId = new Map(assinantes.map((a) => [a.id, a]));
  const alvos = (await (loja.alvosAtivos ? loja.alvosAtivos() : Promise.all(assinantes.map(async (a) => ({ assinante_id: a.id, ...(await loja.alvo(a.id)) })))))
    .filter((x) => porId.has(x.assinante_id))
    .map((x) => {
      const a = porId.get(x.assinante_id);
      let classes = x.classes || ['imperdivel', 'otimo'];
      if (a.silencio_noite !== false && NOITE(agora)) classes = classes.filter((c) => c === 'imperdivel'); // à noite, só imperdível
      return { usuario: a.id, cats: x.cats || [], termos: x.termos || [], descontoMin: x.desconto_min != null ? +x.desconto_min : undefined, orcamento: x.orcamento ? +x.orcamento : 0, classes };
    })
    .filter((x) => x.classes.length && (x.termos.length || x.cats.length)); // sem nada escolhido, não manda nada

  const ofertas = await loja.ofertasAtuais();
  const desde = new Date(agora.getTime() - 3 * 86400000).toISOString();
  const enviados = (await loja.alertasEnviados(desde)).map((e) => ({ usuario: e.assinante_id, chave: e.produto_chave, preco: +e.preco, em: e.enviado_em }));
  const plano = planejarAlertas(alvos, ofertas, enviados, agora);

  let ok = 0;
  for (const p of plano) {
    const a = porId.get(p.usuario), o = ofertas.find((x) => x.chave === p.chave);
    const teclado = { inline_keyboard: [[{ text: 'Ver na loja →', url: o?.url }], [{ text: '🎯 O que vigiar', callback_data: 'vigiar' }, { text: '⚙️ Ajustes', callback_data: 'ajustes' }]] };
    try {
      if (telegram) await telegram.chamar('sendMessage', { chat_id: a.telegram_chat_id, text: p.texto, parse_mode: 'HTML', disable_web_page_preview: false, reply_markup: teclado });
      else log(`\n→ para ${a.nome || a.app_id} (chat ${a.telegram_chat_id})\n${p.texto.replace(/<[^>]+>/g, '')}`);
      await loja.registrarAlerta({ assinante_id: a.id, produto_chave: p.chave, preco: p.preco, oferta_id: o?.ofertaId ?? null });
      ok++;
    } catch (e) {
      log(`falhou para ${a.id}: ${e.message}`);
      if (e.codigo === 403) await loja.atualizarAssinante(a.id, { telegram_chat_id: null }); // a pessoa bloqueou o bot
    }
  }
  log(`Alertas: ${ok} enviados de ${plano.length} planejados, ${alvos.length} pessoas com algo escolhido.`);
  return { enviados: ok, planejados: plano.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--simular')) {
    const { criarLojaMemoria } = await import('./loja-memoria.js');
    const loja = criarLojaMemoria();
    const a = await loja.vincular('app-demo', 1001, 'Milton');
    await loja.salvarAlvo(a.id, { termos: ['secadora', 'inversor'] });
    await enviarAlertas({ loja, telegram: null, agora: new Date('2026-11-20T15:00:00-03:00') });
  } else {
    const { criarLojaSupabase } = await import('./loja-supabase.js');
    const { criarTelegram } = await import('./telegram.js');
    await enviarAlertas({ loja: criarLojaSupabase(), telegram: criarTelegram() });
  }
}
