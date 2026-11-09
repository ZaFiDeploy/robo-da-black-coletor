import { publicoDe, TOPOS_ML } from './departamentos.js';

// Converte as ofertas avaliadas para o formato do app (robo-da-black/data.js → RB_OFERTAS).
// Campos antigos ficam iguais (o app não quebra); campos novos são extras que o app pode passar a usar.

export const SCORE_MIN_VITRINE = 60;

/**
 * Quem entra na vitrine:
 *  - oportunidades checadas com loja segura;
 *  - descontos falsos (educam o comprador);
 *  - ofertas ainda NÃO checadas (sem preço de outras lojas) com loja segura, marcadas como "nao_checado".
 *    O app mostra "a loja diz -X%, ainda não comparamos" e nunca as trata como desconto real.
 */
export function entraNaVitrine(o) {
  if (o.classe === 'falso') return o.referencia > 0;
  if (o.classe === 'sem_desconto') return o.referencia > 0 && o.anunciado > 0; // loja anuncia desconto, a comparação diz que não há: veredito que educa
  if (o.classe === 'sem_dados' || o.classe === 'suspeito') return o.score >= SCORE_MIN_VITRINE && o.anunciado > 0;
  return ['imperdivel', 'otimo', 'bom'].includes(o.classe) && o.score >= SCORE_MIN_VITRINE;
}

/**
 * `classe` fica no conjunto que os apps já conhecem (imperdivel, otimo, bom, falso, nao_checado) para nada quebrar;
 * `veredito` traz a leitura completa (inclui suspeito e sem_desconto) e `motivo` o porquê em uma linha.
 */
export function classeCompativel(classe) {
  if (classe === 'sem_dados' || classe === 'suspeito' || classe === 'sem_desconto') return 'nao_checado';
  return classe;
}

export function paraApp(o) {
  return {
    // --- formato atual do app ---
    id: o.id,
    nome: o.nome,
    cat: o.cat,
    publico: publicoDe(o.nome, o.publico),
    loja: o.loja,
    preco: o.preco,
    de: o.de,
    mercado: round2(o.referencia), // o app chama de "mercado" o preço comum; aqui é a referência escolhida
    lojas: o.lojas ?? 0,
    ...(o.outra ? { outra: o.outra } : {}),
    ...(o.relampago ? { relampago: true } : {}),
    url: o.url,
    img: o.img,
    // --- campos novos ---
    ...(o.top ? { top: o.top } : {}),
    ...(o.sub ? { sub: o.sub, subNome: o.subNome } : {}),
    classe: classeCompativel(o.classe),
    veredito: o.classe === 'sem_dados' ? 'nao_checado' : o.classe, // imperdivel | otimo | bom | sem_desconto | suspeito | falso | nao_checado
    ...(o.motivo ? { motivo: o.motivo } : {}),                       // o porquê em uma linha
    ...(o.lojaRef ? { lojaRef: o.lojaRef } : {}),                    // base 'loja_unica': a outra loja comparada
    real: o.real,
    base: o.base,               // 'mercado' (outras lojas hoje), 'historico' (mediana 60 dias) ou 'loja_unica' (1 outra loja hoje)
    menorEm90: o.menorEm90 || false,
    score: o.score,
    faixa: o.faixa,
    checadoEm: o.checadoEm
  };
}

const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

export function montarSaida({ ofertas }, { agora = new Date() } = {}) {
  const vitrine = ofertas.filter(entraNaVitrine).map(paraApp);
  const hora = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const lojas = [...new Set(vitrine.map((o) => o.loja))];
  const json = {
    geradoEm: agora.toISOString(),
    checadoEm: hora,
    total: vitrine.length,
    porClasse: contar(vitrine.map((o) => o.classe)),
    lojas,
    relampago: vitrine.filter((o) => o.relampago).map((o) => o.id),
    ofertas: vitrine
  };
  const js = `// Gerado pelo robo-da-black-coletor em ${json.geradoEm}. Não editar à mão.\n` +
    `window.RB_CHECADO_EM = ${JSON.stringify(hora)};\n` +
    `window.RB_LOJAS = ${JSON.stringify(lojas)};\n` +
    `window.RB_OFERTAS = ${JSON.stringify(vitrine, null, 1)};\n`;
  return { json, js };
}

function contar(lista) {
  const c = {};
  for (const x of lista) c[x] = (c[x] || 0) + 1;
  return c;
}

/**
 * Saída por departamento (para dezenas de milhares de ofertas o app carrega só o que a pessoa abre).
 * @returns {{ indice: object, arquivos: Record<string, object> }}  arquivos: 'ofertas-MLB1000.json' → { top, ofertas }
 */
export function montarPorDepartamento({ ofertas }, { agora = new Date() } = {}) {
  const vitrine = ofertas.filter(entraNaVitrine).map(paraApp);
  const grupos = new Map();
  for (const o of vitrine) { const k = o.top || 'outros'; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(o); }
  const arquivos = {}, porDepartamento = {};
  for (const [top, lista] of grupos) {
    const nome = `ofertas-${top}.json`;
    arquivos[nome] = { top, nome: TOPOS_ML[top]?.nome ?? 'Outros', geradoEm: agora.toISOString(), ofertas: lista };
    porDepartamento[top] = { nome: TOPOS_ML[top]?.nome ?? 'Outros', arquivo: nome, n: lista.length, checadas: lista.filter((o) => o.classe !== 'nao_checado').length, lojas: [...new Set(lista.map((o) => o.loja))] };
  }
  const hora = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const indice = {
    geradoEm: agora.toISOString(), checadoEm: hora, total: vitrine.length,
    monitorados: ofertas.length, // tudo o que o robô acompanha, inclusive preço de catálogo sem desconto (serve de comparação)
    lojasMonitoradas: [...new Set(ofertas.map((o) => o.loja))],
    checadas: vitrine.filter((o) => o.classe !== 'nao_checado').length,
    porClasse: contar(vitrine.map((o) => o.classe)), lojas: [...new Set(vitrine.map((o) => o.loja))],
    relampago: vitrine.filter((o) => o.relampago).map((o) => o.id), porDepartamento
  };
  return { indice, arquivos };
}
