// Simulador do Jackbot no terminal (sem Telegram, sem banco).
//   node bot/simular.js            → roda o roteiro de demonstração
//   node bot/simular.js --conversar → você digita; "b 3" toca no 3º botão da última mensagem
import readline from 'node:readline';
import { responder } from './conversa.js';
import { criarLojaMemoria } from './loja-memoria.js';

const loja = criarLojaMemoria();
const ctx = { loja, env: { APP_URL: 'https://robo-da-black.vercel.app', FOTO_URL: 'https://exemplo/jackbot.png' }, idade: async () => 12 };
const CHAT = 1001;
let ultima = null, mid = 1;

const limpa = (t) => String(t).replace(/<a href="[^"]*">([^<]*)<\/a>/g, '$1').replace(/<\/?(b|i|s)>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

function mostrar(chamadas) {
  for (const c of chamadas) {
    if (c.metodo === 'answerCallbackQuery') { if (c.params.text) console.log(`   (aviso rápido: ${c.params.text})`); continue; }
    const texto = c.params.text ?? c.params.caption ?? '';
    console.log('\n🤖 Jackbot' + (c.metodo === 'sendPhoto' ? ' [com foto do Jackbot]' : '') + (c.metodo === 'editMessageText' ? ' [atualiza a mensagem]' : ''));
    console.log(limpa(texto).split('\n').map((l) => '   ' + l).join('\n'));
    const kb = c.params.reply_markup?.inline_keyboard;
    if (kb?.length) {
      let n = 0;
      console.log('   ' + kb.map((linha) => linha.map((b) => `[${++n}] ${b.text}${b.url ? ' ↗' : ''}`).join('   ')).join('\n   '));
      ultima = { botoes: kb.flat(), mid: c.params.message_id || mid++ };
    }
  }
}
async function digitar(texto) {
  console.log(`\n👤 Você: ${texto}`);
  mostrar(await responder({ message: { chat: { id: CHAT }, from: { first_name: 'Milton' }, text: texto } }, ctx));
}
async function tocar(n) {
  const b = ultima?.botoes[n - 1];
  if (!b) return console.log('   (não tem botão ' + n + ')');
  console.log(`\n👆 Você tocou: ${b.text}`);
  if (b.url) return console.log('   (abre ' + b.url + ')');
  mostrar(await responder({ callback_query: { id: 'q' + Date.now(), data: b.callback_data, message: { chat: { id: CHAT }, message_id: ultima.mid } } }, ctx));
}

if (process.argv.includes('--conversar')) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('Digite como no Telegram. "b N" toca no botão N. Ctrl+C sai. Comece com /start meu-app-id');
  rl.on('line', async (l) => { const m = l.match(/^b\s+(\d+)$/); m ? await tocar(+m[1]) : await digitar(l); });
} else {
  await digitar('oi');                                   // sem vínculo: manda abrir pelo app
  await digitar('/start app-teste-123');                  // vem do botão "Abrir no Telegram" do app
  await tocar(1); await tocar(3);                         // escolhe Air fryer e Smart TV
  await tocar(11);                                        // Pronto
  await digitar('iPhone 15');                             // escreve um produto
  await digitar('https://www.mercadolivre.com.br/air-fryer-exemplo/p/MLB99999999');   // Black Fraude (exemplo)
  await digitar('https://www.mercadolivre.com.br/secadora/p/MLB24047848');            // real, sem histórico ainda
  await digitar('https://ofertas-magalu-black.shop/produto/iphone');                  // site falso
  await digitar('/relampago');
  await digitar('/ajustes'); await tocar(1);              // só imperdíveis
}
