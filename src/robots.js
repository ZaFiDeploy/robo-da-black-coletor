// Leitura do robots.txt: o robô só entra onde o site permite para "User-agent: *" (ou para o nosso nome).
// Regras na ordem do padrão: a mais longa que casa vence; empate → Allow.

// Robô honesto: se apresenta com nome e um link de contato (ROBO_CONTATO troca o link).
export const UA = `robo-da-black-coletor/0.1 (+${process.env.ROBO_CONTATO || 'https://robo-da-black-app.vercel.app'})`;
export const NOME_ROBO = 'robo-da-black-coletor';

/** Converte um padrão do robots ("/produto/*", "/*?awc=*", "/busca/$") em RegExp. */
function regra(padrao) {
  const re = '^' + padrao.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/\\\$$/, '$');
  return new RegExp(re.endsWith('$') ? re : re);
}

export function lerRobots(texto) {
  const grupos = []; let atual = null;
  for (const linhaCrua of String(texto || '').split(/\r?\n/)) {
    const linha = linhaCrua.replace(/#.*/, '').trim();
    if (!linha) continue;
    const m = linha.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const campo = m[1].toLowerCase(), valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!atual || atual.regras.length) { atual = { agentes: [], regras: [], delay: null }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
    } else if (atual && (campo === 'allow' || campo === 'disallow')) {
      if (valor) atual.regras.push({ permite: campo === 'allow', padrao: valor, re: regra(valor), tam: valor.length });
      else if (campo === 'disallow') atual.regras.push({ permite: true, padrao: '', re: /^/, tam: 0 }); // "Disallow:" vazio = tudo liberado
    } else if (atual && campo === 'crawl-delay') atual.delay = parseFloat(valor) || null;
  }
  return grupos;
}

/** Grupo que vale para nós: o do nosso nome, senão o "*". Sem grupo "*" = site não restringe. */
export function grupoPara(grupos, nome = NOME_ROBO) {
  return grupos.find((g) => g.agentes.some((a) => a === nome.toLowerCase())) || grupos.find((g) => g.agentes.includes('*')) || null;
}

export function permitido(grupos, caminho, nome = NOME_ROBO) {
  const g = grupoPara(grupos, nome);
  if (!g) return true;
  let melhor = null;
  for (const r of g.regras) if (r.re.test(caminho) && (!melhor || r.tam > melhor.tam || (r.tam === melhor.tam && r.permite))) melhor = r;
  return melhor ? melhor.permite : true;
}

/** Baixa e lê o robots.txt de um site. Sem robots (404) = nada proibido. Erro de rede = trata como proibido (não arrisca). */
export async function robotsDe(origem, fetchFn = fetch) {
  try {
    const r = await fetchFn(origem + '/robots.txt', { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
    if (r.status === 404) return { grupos: [], ok: true };
    if (!r.ok) return { grupos: null, ok: false, status: r.status };
    return { grupos: lerRobots(await r.text()), ok: true };
  } catch (e) { return { grupos: null, ok: false, erro: e.message }; }
}
