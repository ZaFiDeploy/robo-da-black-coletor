// Converte o data.js do app (17 ofertas checadas à mão em 07/11/2026) em amostra crua do coletor.
// Uso: node scripts/amostra-de-datajs.js ../robo-da-black/data.js > amostras/ml-2026-11-07.json
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const arquivo = process.argv[2];
const ctx = { window: {} };
vm.runInNewContext(readFileSync(arquivo, 'utf8'), ctx);
const cruas = ctx.window.RB_OFERTAS.map((o) => ({
  fonte: 'manual',
  loja: o.loja,
  titulo: o.nome,
  cat: o.cat,
  preco: o.preco,
  de: o.de,
  url: o.url,
  img: o.img,
  vendedor: { oficial: null, reputacao: null }, // não foi anotado na coleta manual
  promoLoja: o.relampago ? 'relampago' : null,  // a loja marcou como oferta relâmpago
  comparacao: {
    metodo: 'Google Shopping à mão (Chrome do Milton)',
    checadoEm: '2026-11-07T17:00:00-03:00',
    mercado: o.mercado,
    lojas: o.lojas,
    ...(o.outra ? { outra: o.outra } : {})
  }
}));
process.stdout.write(JSON.stringify(cruas, null, 1) + '\n');
