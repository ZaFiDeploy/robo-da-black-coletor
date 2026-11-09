import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escolherRelampago } from '../src/relampago.js';
import { combina, planejarAlertas, textoAlerta } from '../src/alerta.js';

const of = (id, cat, classe, real, score, extra = {}) => ({ id, chave: 'k' + id, cat, classe, real, score, preco: 100, nome: 'Produto ' + id, loja: 'Amazon', referencia: 150, url: 'https://amazon.com.br/' + id, ...extra });

test('Relâmpago: 5, maiores quedas, no máx. 2 por categoria, sem falso nem loja arriscada', () => {
  const lista = [
    of(1, 'tv', 'imperdivel', 0.5, 90), of(2, 'tv', 'imperdivel', 0.45, 90), of(3, 'tv', 'imperdivel', 0.44, 90),
    of(4, 'eletro', 'otimo', 0.2, 85), of(5, 'games', 'otimo', 0.18, 95), of(6, 'moda', 'otimo', 0.16, 88),
    of(7, 'moda', 'falso', 0.0, 99), of(8, 'beleza', 'imperdivel', 0.6, 40), of(9, 'casa', 'bom', 0.09, 99)
  ];
  assert.deepEqual(escolherRelampago(lista).map((o) => o.id), [1, 2, 4, 5, 6]);
});

test('Relâmpago completa com reserva (score ≥ 70) e nunca abaixo disso', () => {
  const lista = [of(1, 'tv', 'imperdivel', 0.5, 90), of(2, 'eletro', 'otimo', 0.3, 72), of(3, 'games', 'otimo', 0.4, 65)];
  assert.deepEqual(escolherRelampago(lista).map((o) => o.id), [1, 2]);
});

test('alvo do robô: categoria, termo, desconto mínimo e orçamento', () => {
  const alvo = { usuario: 'u1', cats: ['tv'], termos: ['smart tv'], descontoMin: 0.15, orcamento: 3000 };
  assert.equal(combina(alvo, of(1, 'tv', 'otimo', 0.2, 90, { nome: 'Smart TV LG 50"', preco: 2000 })), true);
  assert.equal(combina(alvo, of(2, 'tv', 'otimo', 0.2, 90, { nome: 'Smart TV LG 65"', preco: 4000 })), false); // orçamento
  assert.equal(combina(alvo, of(3, 'tv', 'bom', 0.1, 90, { nome: 'Smart TV' })), false);                     // desconto
  assert.equal(combina(alvo, of(4, 'tv', 'falso', 0.0, 90, { nome: 'Smart TV' })), false);
  assert.equal(combina(alvo, of(5, 'tv', 'otimo', 0.2, 50, { nome: 'Smart TV' })), false);                   // loja arriscada
});

test('não repete alerta; reavisa só se cair mais 5%', () => {
  const alvos = [{ usuario: 'u1' }];
  const agora = new Date('2026-11-27T10:00:00Z');
  const enviados = [{ usuario: 'u1', chave: 'k1', preco: 100, em: '2026-11-26T10:00:00Z' }];
  assert.equal(planejarAlertas(alvos, [of(1, 'tv', 'otimo', 0.2, 90, { preco: 97 })], enviados, agora).length, 0);
  const r = planejarAlertas(alvos, [of(1, 'tv', 'otimo', 0.25, 90, { preco: 94 })], enviados, agora);
  assert.equal(r.length, 1);
  assert.match(r[0].texto, /caiu de novo/);
});

test('limite de alertas por dia', () => {
  const ofertas = Array.from({ length: 20 }, (_, i) => of(i + 1, 'tv', 'otimo', 0.2, 90));
  assert.equal(planejarAlertas([{ usuario: 'u1' }], ofertas, [], new Date()).length, 8);
});

test('texto do Telegram escapa HTML e mostra segurança', () => {
  const t = textoAlerta(of(1, 'tv', 'imperdivel', 0.4, 92, { nome: 'TV <50"> & cia', preco: 1999.9, referencia: 3333 }));
  assert.match(t, /TV &lt;50&quot;&gt; &amp; cia/);
  assert.match(t, /R\$ 1\.999,90/);
  assert.match(t, /Segurança 92\/100/);
});
