// Receptor local: o Chrome faz POST do texto coletado e este script grava num arquivo.
// Uso: node scripts/receber.js <porta> <arquivo-de-saida>
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
const [porta, arquivo] = process.argv.slice(2);
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': '*', 'access-control-allow-private-network': 'true' };
createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); } // Chrome exige para site público → localhost
  if (req.method !== 'POST') { res.writeHead(200, { 'content-type': 'text/plain', ...cors }); return res.end('ok'); }
  let corpo = '';
  req.on('data', (c) => { corpo += c; });
  req.on('end', () => {
    // aceita texto puro ou formulário (campo "d") — o formulário é o que o Chrome deixa mandar para o localhost
    const texto = /^d=/.test(corpo) ? decodeURIComponent(corpo.slice(2).replace(/\+/g, ' ')) : corpo;
    writeFileSync(arquivo, texto); console.log(`gravado ${texto.length} caracteres em ${arquivo}`);
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', ...cors }); res.end('ok ' + texto.length);
  });
}).listen(+porta, '127.0.0.1', () => console.log('ouvindo em', porta));
