// Gera o caca.js do app a partir dos módulos do coletor (uma fonte só para as regras).
// Uso: node scripts/gerar-caca-browser.js ../robo-da-black/caca.js
import { readFileSync, writeFileSync } from 'node:fs';

const destino = process.argv[2];
const modulos = ['links.js', 'antes-depois.js', 'score.js', 'departamentos.js'];
let corpo = '';
for (const m of modulos) {
  const src = readFileSync(new URL(`../src/${m}`, import.meta.url), 'utf8');
  if (/^\s*import\s/m.test(src)) throw new Error(`${m} importa outro módulo; o gerador não junta imports`);
  corpo += `\n  // ----- ${m} -----\n` + src.replace(/^export\s+/gm, '').replace(/^/gm, '  ');
}
const saida = `/* Robô da Black — Caça Black Fraude no navegador.
 * GERADO por robo-da-black-coletor/scripts/gerar-caca-browser.js a partir de src/links.js,
 * src/antes-depois.js, src/score.js e src/departamentos.js. Não editar à mão: mudar lá e gerar de novo. */
(function () {
  'use strict';
${corpo}
  window.RBCaca = { idDoLink, serieDiaria, compararAntesDepois, analisarUrl, scoreSeguranca, REGRAS_AD, publicoDe, DEPARTAMENTOS, noDepartamento, subcategorias, TOPOS_ML };
})();
`;
writeFileSync(destino, saida);
console.log('gerado', destino, saida.length, 'bytes');
