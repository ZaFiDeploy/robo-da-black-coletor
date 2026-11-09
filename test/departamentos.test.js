import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicoDe, DEPARTAMENTOS, TOPOS_ML, noDepartamento, subcategorias } from '../src/departamentos.js';

const dep = (id) => DEPARTAMENTOS.find((d) => d.id === id);

test('público pelo título', () => {
  assert.equal(publicoDe('Vestido Midi Feminino Canelado'), 'feminino');
  assert.equal(publicoDe('Tênis Masculino Olympikus'), 'masculino');
  assert.equal(publicoDe('Tênis Infantil Menina Luz'), 'infantil'); // menina = infantil, não feminino
  assert.equal(publicoDe('Smart TV LG 50"'), 'unissex');
  assert.equal(publicoDe('Qualquer coisa', 'feminino'), 'feminino'); // a fonte manda
});

test('um departamento por categoria de topo do ML, mais 5 atalhos', () => {
  assert.equal(DEPARTAMENTOS.length, Object.keys(TOPOS_ML).length + 5);
  assert.equal(dep('moda').nome, 'Calçados, Roupas e Bolsas');
  assert.equal(new Set(DEPARTAMENTOS.map((d) => d.id)).size, DEPARTAMENTOS.length, 'ids únicos');
});

test('departamento pelo topo do ML, pelo público, pela classe e oferta antiga pelo cat', () => {
  const vestido = { nome: 'Vestido longo feminino', cat: 'moda', top: 'MLB1430', sub: 'MLB108704' };
  assert.equal(noDepartamento(dep('moda'), vestido, 'nao_checado'), true);
  assert.equal(noDepartamento(dep('feminino'), vestido, 'nao_checado'), true);
  assert.equal(noDepartamento(dep('masculino'), vestido, 'nao_checado'), false);
  assert.equal(noDepartamento(dep('oportunidades'), vestido, 'nao_checado'), false);
  assert.equal(noDepartamento(dep('oportunidades'), vestido, 'imperdivel'), true);
  assert.equal(noDepartamento(dep('infantil'), { nome: 'Lego Classic', top: 'MLB1132' }, 'bom'), true);
  assert.equal(noDepartamento(dep('moda'), { nome: 'Mochila de viagem', cat: 'viagens' }, 'bom'), true); // legado
  assert.equal(noDepartamento(dep('moveis'), { nome: 'Smart TV', cat: 'tv', top: 'MLB1000' }, 'bom'), false);
  assert.equal(noDepartamento(dep('todos'), vestido, 'falso'), true);
});

test('subcategorias escritas com contagem, "Outros" no fim', () => {
  const s = subcategorias([
    { sub: 'MLB108704', subNome: 'Vestidos' }, { sub: 'MLB3112', subNome: 'Blusas' }, { sub: 'MLB108704', subNome: 'Vestidos' }, {}
  ]);
  assert.deepEqual(s.map((x) => `${x.nome} (${x.n})`), ['Blusas (1)', 'Vestidos (2)', 'Outros (1)']);
});
