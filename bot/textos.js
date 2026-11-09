// Jackbot no Telegram: tudo o que ele fala e os botões. Tom do app: dinheiro, curto, sem cassino.
// Mensagens em HTML do Telegram (<b>, <i>, <a>). Nada de caixa alta gritando.

export const SUGESTOES = ['Air fryer', 'Smart TV', 'iPhone', 'Galaxy', 'Notebook', 'Geladeira', 'Ar-condicionado', 'Perfume', 'PS5', 'Tênis'];

export const AVISOS = {
  imperdivel: { nome: 'Só imperdíveis', sub: '30% ou mais abaixo do preço comum', classes: ['imperdivel'] },
  otimo: { nome: 'Ótimo preço ou melhor', sub: '15% ou mais abaixo', classes: ['imperdivel', 'otimo'] },
  real: { nome: 'Qualquer desconto de verdade', sub: '5% ou mais abaixo', classes: ['imperdivel', 'otimo', 'bom'] }
};
export function avisoAtual(classes = []) {
  if (classes.includes('bom')) return 'real';
  if (classes.includes('otimo')) return 'otimo';
  return 'imperdivel';
}

// Menu de comandos e descrições do perfil (usados por configurar.js e rodar-local.js).
export const COMANDOS = [
  { command: 'vigiar', description: 'O que estou vigiando para você' },
  { command: 'checar', description: 'Checar se o desconto de um link é de verdade' },
  { command: 'relampago', description: 'As maiores quedas reais de hoje' },
  { command: 'ajustes', description: 'Quando e como te aviso' },
  { command: 'pausar', description: 'Pausar os alertas' },
  { command: 'ajuda', description: 'Como o Jackbot funciona' }
];
export const DESCRICAO_CURTA = 'Vigio os produtos que você quer e aviso quando o preço cai de verdade. Pego desconto falso.';
export const DESCRICAO = 'Eu sou o Jackbot, o robô do Robô da Black.\n\n🎯 Você me diz o que quer comprar.\n🔔 Eu aviso quando o preço cair de verdade.\n🚨 Mostro quando o desconto é falso.\n🛡️ Dou uma nota de segurança para cada oferta.\n\nToque em Iniciar para começar.';

const b = (text, callback_data) => ({ text, callback_data });
const u = (text, url) => ({ text, url });

export const MENU = [
  [b('🎯 O que vigiar', 'vigiar'), b('🔎 Checar um link', 'checar')],
  [b('⚡ Relâmpago de hoje', 'relampago'), b('⚙️ Ajustes', 'ajustes')]
];

export const T = {
  boasVindas: (nome) =>
    `Oi${nome ? ', ' + esc(nome) : ''}! Eu sou o <b>Jackbot</b> 🤖\n\n` +
    'Vou vigiar os produtos que você quer e te aviso <b>aqui</b> quando o preço cair <b>de verdade</b>.\n\n' +
    'E pego desconto falso: me mande o link de qualquer produto e eu checo na hora.',
  primeiroAlvo:
    '<b>O que você quer comprar na Black?</b>\n\nToque nas sugestões ou escreva o nome do produto, um por vez. Ex.: <i>air fryer</i>, <i>iPhone 15</i>, <i>geladeira frost free</i>.',
  semVinculo:
    'Para eu saber que é você, ative o robô pelo app do <b>Robô da Black</b>: aba <b>Robô</b> → <b>Abrir no Telegram</b>.\n\nÉ um toque só.',
  menu: 'O que vamos fazer?',
  pedirLink: 'Cole aqui o link do produto. Funciona com Mercado Livre, Amazon, Shopee, KaBuM!, Magalu, Americanas e qualquer outro site.',
  linkInvalido: 'Não achei um link de produto aí. Abra a página do produto, toque em <b>compartilhar</b> → <b>copiar link</b> e cole aqui.',
  linkEncurtado: 'Esse link é encurtado. Abra ele no navegador, copie o endereço completo da página do produto e cole aqui.',
  nomeLongo: 'Mande só o nome do produto, tipo <i>air fryer</i> ou <i>iPhone 15</i>.',
  anotado: (t) => `Anotado ✅ Vou vigiar <b>${esc(t)}</b>.`,
  jaTinha: (t) => `Já estou vigiando <b>${esc(t)}</b>.`,
  pausado: '⏸ Alertas pausados. Quando quiser, toque em <b>Voltar a avisar</b>.',
  voltou: '▶️ Pronto, voltei a vigiar. Te aviso quando cair de verdade.',
  semRelampago: 'Ainda não tenho as relâmpago de hoje. Elas saem depois da primeira coleta do dia.',
  ajuda:
    '<b>Como eu funciono</b>\n\n' +
    '🎯 Você me diz o que quer comprar. Eu comparo o preço todo dia, em várias lojas.\n' +
    '🔔 Quando cair de verdade, eu te aviso aqui.\n' +
    '🚨 Se a loja anunciar um desconto que não existe, eu te mostro.\n' +
    '🛡️ Toda oferta vem com uma nota de segurança de 0 a 100.\n\n' +
    'Comandos: /vigiar · /checar · /relampago · /ajustes · /pausar'
};

export const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const reais = (n) => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const teclado = {
  menu: () => ({ inline_keyboard: MENU }),
  sugestoes: (termos) => {
    const lin = [];
    SUGESTOES.forEach((s, i) => {
      const on = termos.some((t) => t.toLowerCase() === s.toLowerCase());
      if (i % 2 === 0) lin.push([]);
      lin[lin.length - 1].push(b((on ? '✅ ' : '') + s, 'sug:' + i));
    });
    lin.push([b('Pronto ✔️', 'vigiar')]);
    return { inline_keyboard: lin };
  },
  lista: (termos, vigiados) => ({
    inline_keyboard: [
      ...termos.map((t, i) => [b('✖ ' + t, 'rm:' + i)]),
      ...vigiados.map((v) => [b('✖ ' + (v.nome || v.loja) + ' (link)', 'rmv:' + v.id)]),
      [b('➕ Sugestões', 'sugestoes'), b('🔎 Checar um link', 'checar')],
      [b('⬅️ Menu', 'menu')]
    ]
  }),
  ajustes: (a) => ({
    inline_keyboard: [
      ...Object.entries(AVISOS).map(([id, x]) => [b((a.aviso === id ? '🔘 ' : '⚪ ') + x.nome, 'av:' + id)]),
      [b((a.silencio ? '🌙 Silêncio à noite: ligado' : '🌙 Silêncio à noite: desligado'), 'noite')],
      [b(a.pausado ? '▶️ Voltar a avisar' : '⏸ Pausar alertas', 'pausa')],
      [b('⬅️ Menu', 'menu')]
    ]
  }),
  checado: (url, podeVigiar) => ({
    inline_keyboard: [
      [u('Ver na loja →', url)],
      ...(podeVigiar ? [[b('🔔 Vigiar esse preço', 'vg')]] : []),
      [b('⬅️ Menu', 'menu')]
    ]
  }),
  voltar: () => ({ inline_keyboard: [[b('⬅️ Menu', 'menu')]] }),
  desfazer: (i) => ({ inline_keyboard: [[b('↩️ Desfazer', 'rm:' + i), b('🎯 Ver lista', 'vigiar')]] }),
  abrirApp: (url) => ({ inline_keyboard: url ? [[u('Abrir o Robô da Black', url)]] : [] })
};
