// Cada fonte tem a própria árvore de categorias. Aqui tudo vira o `cat` interno do app (e, quando dá, o `top` do ML),
// para o departamento e as missões funcionarem igual para KaBuM!, Awin, Shopee, Lomadee, impact e TikTok.
// Regra: casa pelo nome da categoria da loja (sem acento, minúsculo); se não casar, cai no título; se nada casar, 'outros'.

import { TOPOS_ML } from './departamentos.js';

const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// [regex sobre a categoria da loja ou o título] → cat interno. Ordem importa: primeiro o mais específico.
const MAPA = [
  [/celular|smartphone|iphone|galaxy|telefon/, 'celulares'],
  [/\btvs?\b|smart tv|televis|soundbar|home theater|caixa de som|fone|headphone|audio|áudio|projetor/, 'tv'],
  [/notebook|computador|hardware|perif[eé]ric|monitor|teclado|mouse|impressora|ssd|mem[oó]ria ram|placa de v[ií]deo|roteador|informatica|informática|tablet/, 'informatica'],
  [/\bgames?\b|gamer|console|playstation|xbox|nintendo|controle/, 'games'],
  [/c[aâ]mera|drone|gopro/, 'cameras'],
  [/geladeira|refrigerador|fog[aã]o|cooktop|forno|coifa|depurador|purificador|lava|secadora|ar.condicionado|climatiza|micro-?ondas|eletrodom[eé]stico|eletroport[aá]te|air ?fryer|aspirador|ventilador|cafeteira|liquidificador|batedeira|panificadora|m[aá]quina de gelo/, 'eletro'],
  [/cozinha|panela|utens[ií]lio|talher|copo|ta[cç]a/, 'cozinha'],
  [/m[oó]ve|sof[aá]|cama|colch[aã]o|decora|ilumina|lumin[aá]ria|cortina|tapete|toalha|len[cç]ol|organiza|banheiro|jardim/, 'moveis'],
  [/ferramenta|furadeira|parafusadeira|lavadora de alta|serra|solda|kit de chaves/, 'ferramentas'],
  [/constru|tinta|piso|torneira|chuveiro|el[eé]trica|fio|disjuntor/, 'construcao'],
  [/t[eê]nis|cal[cç]ado|sapato|sand[aá]lia|chinelo|bota|roupa|camiseta|camisa|cal[cç]a|vestido|moda|bolsa|mochila|mala|jaqueta|moletom|bermuda|short|lingerie|cueca|meia/, 'moda'],
  [/perfume|maquiagem|beleza|cabelo|shampoo|skincare|cuidado pessoal|barbeador|secador|chapinha/, 'beleza'],
  [/suplemento|creatina|whey|vitamina|sa[uú]de|farm[aá]cia|massagem|fitness|academia|muscula/, 'suplementos'],
  [/esporte|bicicleta|bike|futebol|nata[cç][aã]o|camping|pesca/, 'esporte'],
  [/brinquedo|lego|boneca|pel[uú]cia|jogo de tabuleiro|hobby|colecion/, 'brinquedos'],
  [/beb[eê]|fralda|carrinho de beb|cadeirinha|mamadeira/, 'bebes'],
  [/\bpet\b|cachorro|gato|ra[cç][aã]o|aqu[aá]rio/, 'pet'],
  [/automotivo|ve[ií]culo|carro|moto|pneu|som automotivo|acess[oó]rios para ve/, 'automotivo'],
  [/papelaria|caderno|caneta|escolar|arte|armarinho/, 'papelaria'],
  [/festa|lembrancinha|decora[cç][aã]o de festa|bal[aã]o/, 'festas'],
  [/instrumento|viol[aã]o|guitarra|teclado musical|bateria musical|microfone/, 'instrumentos'],
  [/j[oó]ia|rel[oó]gio|smartwatch|[oó]culos|bijuteria/, 'joias'],
  [/alimento|bebida|mercado|limpeza|sab[aã]o|detergente|caf[eé]|cerveja|vinho/, 'mercado'],
  [/viagem|passagem|hotel/, 'viagens']
];

const CAT_PARA_TOP = Object.fromEntries(Object.entries(TOPOS_ML).map(([top, t]) => [t.cat, top]));
CAT_PARA_TOP.cozinha = 'MLB1574'; CAT_PARA_TOP.viagens = 'MLB1430';

/** @returns {{cat: string, top: string|null, por: 'categoria'|'titulo'|'nenhum'}} */
export function categoriaInterna({ catLoja, caminhoLoja = [], titulo }) {
  const textos = [[catLoja, 'categoria'], ...caminhoLoja.slice().reverse().map((c) => [c, 'categoria']), [titulo, 'titulo']];
  for (const [texto, por] of textos) {
    const t = sem(texto);
    if (!t) continue;
    for (const [re, cat] of MAPA) if (re.test(t)) return { cat, top: CAT_PARA_TOP[cat] ?? null, por };
  }
  return { cat: 'outros', top: null, por: 'nenhum' };
}

/** Preenche cat/top nas ofertas cruas que vieram sem (sitemap, feeds). Não mexe em quem já tem. */
export function classificarCategorias(cruas) {
  for (const o of cruas) {
    if (o.cat && o.cat !== 'outros' && !o.top && CAT_PARA_TOP[o.cat]) o.top = CAT_PARA_TOP[o.cat]; // oferta antiga: só tinha cat
    if (o.cat && o.cat !== 'outros' && o.top) continue;
    const r = categoriaInterna(o);
    if (!o.cat || o.cat === 'outros') o.cat = r.cat;
    if (!o.top && r.top) o.top = r.top;
    // "Hardware/Coolers/FAN/120 mm" (KaBuM!) → subcategoria escrita = 2º nível ("Coolers"); 1 nível só = ele mesmo
    const partes = String(o.catLoja || '').split('/').map((x) => x.trim()).filter(Boolean);
    const subNome = partes.length >= 2 ? partes[1] : partes[0] || null;
    if (!o.subNome && subNome) o.subNome = subNome;
    if (!o.sub && subNome) o.sub = 'loja:' + sem(subNome).replace(/[^a-z0-9]+/g, '-');
  }
  return cruas;
}
