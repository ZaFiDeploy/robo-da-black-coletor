// Normalizador de produto: decide quando duas ofertas de lojas diferentes são o MESMO produto.
// Ordem de confiança: EAN/GTIN  >  marca + modelo  >  título normalizado (com travas de atributo).

const PALAVRAS_VAZIAS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'pra', 'em', 'a', 'o', 'as', 'os', 'um', 'uma', 'no', 'na', 'por',
  // palavras de vitrine que não descrevem o produto
  'novo', 'nova', 'original', 'oferta', 'promocao', 'lancamento', 'envio', 'imediato', 'frete', 'gratis', 'full',
  'garantia', 'nf', 'nota', 'fiscal', 'pronta', 'entrega', 'kit', 'cor', 'versao', 'edicao', 'modelo', 'produto',
  'lacrado', 'oficial', 'brasil', 'nacional', 'black', 'friday', 'preto', 'branco', 'unidade', 'un'
]);

// Marcas mais comuns nas categorias do app. Lista curta de propósito: serve para separar "marca" de "modelo".
const MARCAS = [
  'samsung', 'apple', 'motorola', 'xiaomi', 'lg', 'sony', 'philips', 'philco', 'tcl', 'aoc', 'dell', 'lenovo', 'acer',
  'asus', 'hp', 'positivo', 'multilaser', 'jbl', 'electrolux', 'brastemp', 'consul', 'midea', 'mondial', 'britania',
  'arno', 'oster', 'walita', 'cadence', 'tramontina', 'karcher', 'bosch', 'makita', 'black+decker', 'vonder', 'wap',
  'tp-link', 'intelbras', 'xbox', 'playstation', 'nintendo', 'ventisol', 'buddemeyer', 'wella', 'loreal', 'natura',
  'boticario', 'ype', 'omo', 'growth', 'soldiers', 'integralmedica', 'max titanium', 'starlink', 'gree', 'springer',
  'fischer', 'nespresso', 'dolce gusto', 'redmi', 'realme', 'infinix', 'nike', 'adidas', 'olympikus', 'mizuno'
];

/** minúsculas, sem acento, sem pontuação solta */
export function semAcento(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Padroniza unidades para que "128 GB", "128gb" e "128 gigas" virem o mesmo token. */
export function unidades(t) {
  return t
    .replace(/(\d)[.,](\d{3})(?!\d)/g, '$1$2') // 12.000 -> 12000
    .replace(/(\d+)\s*(gb|giga|gigas)\b/g, '$1gb')
    .replace(/(\d+)\s*(tb|tera)\b/g, '$1tb')
    .replace(/(\d+)\s*(mah)\b/g, '$1mah')
    .replace(/(\d+)\s*(btus?|btu\/h)\b/g, '$1btu')
    .replace(/(\d+)\s*(w|watts?)\b/g, '$1w')
    .replace(/(\d+)\s*(v|volts?)\b/g, '$1v')
    .replace(/(\d+)\s*(hz)\b/g, '$1hz')
    .replace(/(\d+)\s*(kg|quilos?)\b/g, '$1kg')
    .replace(/(\d+)\s*(g|gramas?)\b/g, '$1g')
    .replace(/(\d+)\s*(ml)\b/g, '$1ml')
    .replace(/(\d+)\s*(l|litros?)\b/g, '$1l')
    .replace(/(\d+)\s*(psi)\b/g, '$1psi')
    .replace(/(\d+(?:[.,]\d)?)\s*("|''|pol|polegadas?)(?=\s|$|,)/g, (_, n) => n.replace(',', '.') + 'pol');
}

/** Lista de tokens limpos do título (sem palavras vazias, unidades padronizadas). */
export function tokens(titulo) {
  const t = unidades(semAcento(titulo))
    .replace(/[^a-z0-9+.\- ]/g, ' ')
    .replace(/\s[-.]\s/g, ' ');
  return t.split(/\s+/)
    .map((x) => x.replace(/^[-.]+|[-.]+$/g, ''))
    .filter((x) => x && !PALAVRAS_VAZIAS.has(x));
}

/** Atributos que, se diferentes, provam que NÃO é o mesmo produto (128gb x 256gb, 110v x 220v...). */
export function atributos(titulo) {
  const t = tokens(titulo).join(' ');
  const pega = (re) => [...t.matchAll(re)].map((m) => m[0]).sort();
  return {
    armazenamento: pega(/\b\d+(gb|tb)\b/g),
    potencia: pega(/\b\d+(btu|w)\b/g),
    tamanho: pega(/\b\d+(?:\.\d)?pol\b/g),
    volume: pega(/\b\d+(ml|l|kg|g)\b/g),
    voltagem: pega(/\b(110|127|220|bivolt)v?\b/g).map((v) => v.replace(/v$/, ''))
  };
}

function conflitam(a, b) {
  for (const k of Object.keys(a)) {
    if (!a[k].length || !b[k].length) continue; // um dos lados não informou: não dá para afirmar conflito
    if (a[k].join('|') !== b[k].join('|')) return k;
  }
  return null;
}

/** EAN/GTIN válido (8, 12, 13 ou 14 dígitos com dígito verificador certo). */
export function eanValido(ean) {
  const d = String(ean ?? '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(d.length) || /^0+$/.test(d)) return false;
  const nums = d.split('').map(Number);
  const verif = nums.pop();
  const soma = nums.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === verif;
}

export function marcaDe(titulo, marcaInformada) {
  if (marcaInformada) return semAcento(marcaInformada).trim();
  const t = ' ' + tokens(titulo).join(' ') + ' ';
  for (const m of MARCAS) if (t.includes(' ' + m + ' ')) return m;
  return null;
}

/** Modelo = token que mistura letras e números e não é unidade (STL11, C320WS, UN85C, A36, IF-378). */
export function modeloDe(titulo, modeloInformado) {
  if (modeloInformado) return semAcento(modeloInformado).replace(/[^a-z0-9]/g, '');
  const candidatos = tokens(titulo).filter((x) =>
    /[a-z]/.test(x) && /\d/.test(x) && x.length >= 3 &&
    !/^\d+(gb|tb|mah|btu|w|v|hz|kg|g|ml|l|psi|pol|k)$/.test(x) && !/^\d+(a|o)$/.test(x) && !/^[45]g$/.test(x)
  );
  if (!candidatos.length) return null;
  // o mais longo costuma ser o código do fabricante
  return candidatos.sort((a, b) => b.length - a.length)[0].replace(/[^a-z0-9]/g, '');
}

/**
 * Chave do produto canônico.
 *   ean:7891234567895        -> confiança alta
 *   mod:electrolux|stl11     -> confiança média
 *   tit:aoc|agon|g50|...     -> confiança baixa (só junta com similaridade alta)
 */
export function chaveProduto({ titulo, ean, marca, modelo }) {
  if (eanValido(ean)) return { chave: 'ean:' + String(ean).replace(/\D/g, '').padStart(14, '0'), confianca: 'alta' };
  const mc = marcaDe(titulo, marca), md = modeloDe(titulo, modelo);
  if (mc && md) {
    // o mesmo modelo vem em versões (128 GB x 256 GB, 110 V x 220 V): a versão entra na chave
    const at = Object.values(atributos(titulo)).flat().join(',');
    return { chave: `mod:${mc}|${md}${at ? '|' + at : ''}`, confianca: 'media' };
  }
  const tk = [...new Set(tokens(titulo))].sort().slice(0, 12);
  return { chave: 'tit:' + tk.join('|'), confianca: 'baixa' };
}

/** Jaccard entre os conjuntos de tokens (0 a 1). */
export function similaridade(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Decide se duas ofertas são o mesmo produto.
 * Retorna { mesmo: boolean, por: 'ean'|'modelo'|'titulo'|..., motivo }
 */
export function mesmoProduto(x, y, { limiarTitulo = 0.6 } = {}) {
  const ex = eanValido(x.ean), ey = eanValido(y.ean);
  if (ex && ey) {
    const igual = String(x.ean).replace(/\D/g, '').padStart(14, '0') === String(y.ean).replace(/\D/g, '').padStart(14, '0');
    return { mesmo: igual, por: 'ean', motivo: igual ? 'EAN igual' : 'EAN diferente' };
  }
  const conflito = conflitam(atributos(x.titulo), atributos(y.titulo));
  if (conflito) return { mesmo: false, por: 'atributo', motivo: `atributo diferente: ${conflito}` };

  const mx = marcaDe(x.titulo, x.marca), my = marcaDe(y.titulo, y.marca);
  if (mx && my && mx !== my) return { mesmo: false, por: 'marca', motivo: 'marca diferente' };
  const dx = modeloDe(x.titulo, x.modelo), dy = modeloDe(y.titulo, y.modelo);
  if (dx && dy) return { mesmo: dx === dy, por: 'modelo', motivo: dx === dy ? 'mesmo modelo' : 'modelo diferente' };

  const s = similaridade(x.titulo, y.titulo);
  return { mesmo: s >= limiarTitulo, por: 'titulo', motivo: `similaridade ${s.toFixed(2)}` };
}
