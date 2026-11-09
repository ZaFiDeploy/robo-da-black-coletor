// Departamentos da vitrine, iguais aos do Mercado Livre (categoria de topo + subcategorias escritas),
// mais 4 atalhos nossos: Oportunidades, Feminino, Masculino e Infantil.
// Cada oferta tem: cat (id interno do app, usado pelas missões), top (categoria de topo do ML),
// sub/subNome (subcategoria do ML) e público (sai do título quando a fonte não informa).

const PUBLICO = [
  // ordem importa: "menina" é infantil antes de ser feminino
  ['infantil', /\b(infantil|infantis|crianca|criancas|bebe|bebes|kids|menino|menina|meninos|meninas|juvenil|baby)\b/],
  ['feminino', /\b(feminin[oa]s?|mulher|mulheres|moca|lady|vestido|saia|blusa|blusinha|cropped|sutia|calcinha|biquini|maio|legging|scarpin|salto alto|batom|maquiagem|esmalte|absorvente|bolsa feminina|lingerie)\b/],
  ['masculino', /\b(masculin[oa]s?|homem|homens|cueca|barbeador|barba|aparador de pelos|bermuda masculina)\b/]
];

const semAcentoDep = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** 'feminino' | 'masculino' | 'infantil' | 'unissex' */
export function publicoDe(titulo, informado) {
  if (informado) return informado;
  const t = semAcentoDep(titulo);
  for (const [p, re] of PUBLICO) if (re.test(t)) return p;
  return 'unissex';
}

// Categorias de topo do Mercado Livre (ids reais lidos do filtro de /ofertas em 07/11/2026) → id interno do app.
export const TOPOS_ML = {
  MLB5672: { cat: 'automotivo', nome: 'Acessórios para Veículos', icone: 'car' },
  MLB1403: { cat: 'mercado', nome: 'Alimentos e Bebidas', icone: 'shopping-basket' },
  MLB1368: { cat: 'papelaria', nome: 'Arte, Papelaria e Armarinho', icone: 'pencil' },
  MLB1384: { cat: 'bebes', nome: 'Bebês', icone: 'baby' },
  MLB1246: { cat: 'beleza', nome: 'Beleza e Cuidado Pessoal', icone: 'sparkles' },
  MLB1132: { cat: 'brinquedos', nome: 'Brinquedos e Hobbies', icone: 'puzzle' },
  MLB1430: { cat: 'moda', nome: 'Calçados, Roupas e Bolsas', icone: 'shirt' },
  MLB1574: { cat: 'moveis', nome: 'Casa, Móveis e Decoração', icone: 'sofa' },
  MLB1051: { cat: 'celulares', nome: 'Celulares e Telefones', icone: 'smartphone' },
  MLB1500: { cat: 'construcao', nome: 'Construção', icone: 'brick-wall' },
  MLB1039: { cat: 'cameras', nome: 'Câmeras e Acessórios', icone: 'camera' },
  MLB5726: { cat: 'eletro', nome: 'Eletrodomésticos', icone: 'refrigerator' },
  MLB1000: { cat: 'tv', nome: 'Eletrônicos, Áudio e Vídeo', icone: 'tv' },
  MLB1276: { cat: 'esporte', nome: 'Esportes e Fitness', icone: 'dumbbell' },
  MLB263532: { cat: 'ferramentas', nome: 'Ferramentas', icone: 'hammer' },
  MLB12404: { cat: 'festas', nome: 'Festas e Lembrancinhas', icone: 'party-popper' },
  MLB1144: { cat: 'games', nome: 'Games', icone: 'gamepad-2' },
  MLB1648: { cat: 'informatica', nome: 'Informática', icone: 'laptop' },
  MLB1182: { cat: 'instrumentos', nome: 'Instrumentos Musicais', icone: 'guitar' },
  MLB3937: { cat: 'joias', nome: 'Joias e Relógios', icone: 'gem' },
  MLB1071: { cat: 'pet', nome: 'Pet Shop', icone: 'paw-print' },
  MLB264586: { cat: 'suplementos', nome: 'Saúde', icone: 'heart-pulse' }
};

// Ofertas antigas (sem "top") entram pelo cat.
const CATS_LEGADOS = { MLB1430: ['moda', 'viagens'], MLB1574: ['moveis', 'cozinha'] };

export const DEPARTAMENTOS = [
  { id: 'todos', nome: 'Todos', icone: 'layout-grid' },
  { id: 'oportunidades', nome: 'Oportunidades', icone: 'flame', classes: ['imperdivel', 'otimo'] },
  { id: 'feminino', nome: 'Feminino', icone: 'flower-2', publico: 'feminino' },
  { id: 'masculino', nome: 'Masculino', icone: 'user-round', publico: 'masculino' },
  { id: 'infantil', nome: 'Infantil', icone: 'baby', publico: 'infantil', tops: ['MLB1384', 'MLB1132'] }
].concat(Object.entries(TOPOS_ML).map(([top, t]) => ({ id: t.cat, nome: t.nome, icone: t.icone, top, cats: CATS_LEGADOS[top] || [t.cat] })));

/**
 * A oferta entra no departamento?
 * @param {object} dep    item de DEPARTAMENTOS
 * @param {object} o      oferta { nome, cat, top?, publico? }
 * @param {string} classe classe do desconto real (imperdivel, otimo, bom, falso, nao_checado...)
 */
export function noDepartamento(dep, o, classe) {
  if (!dep || dep.id === 'todos') return true;
  if (dep.classes) return dep.classes.includes(classe);
  if (dep.publico && publicoDe(o.nome, o.publico) === dep.publico) return true;
  if (dep.tops && dep.tops.includes(o.top)) return true;
  if (dep.top) return o.top ? o.top === dep.top : (dep.cats || []).includes(o.cat);
  return false;
}

/**
 * Subcategorias escritas (como o seletor do Mercado Livre) das ofertas de um departamento.
 * @returns {Array<{id, nome, n}>} em ordem alfabética, com contagem
 */
export function subcategorias(ofertas) {
  const m = new Map();
  for (const o of ofertas) {
    const id = o.sub || 'outros', nome = o.subNome || 'Outros';
    const x = m.get(id) || { id, nome, n: 0 };
    x.n++; m.set(id, x);
  }
  return [...m.values()].sort((a, b) => (a.id === 'outros') - (b.id === 'outros') || a.nome.localeCompare(b.nome, 'pt-BR'));
}
