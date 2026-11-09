// Idade do domínio por RDAP (registro público, sem login e sem chave).
// .br → registro.br; o resto → rdap.org (redireciona para o registro certo).
// Uso leve: uma consulta por domínio, com cache. Nada de varrer em massa.

const cache = new Map();

export async function idadeDominioDias(host, { agora = new Date(), fetchFn = fetch } = {}) {
  const partes = host.toLowerCase().replace(/^www\./, '').split('.');
  const dominio = partes.slice(host.endsWith('.br') ? -3 : -2).join('.');
  if (cache.has(dominio)) return cache.get(dominio);
  const url = dominio.endsWith('.br') ? `https://rdap.registro.br/domain/${dominio}` : `https://rdap.org/domain/${dominio}`;
  let dias = null;
  try {
    const r = await fetchFn(url, { headers: { accept: 'application/rdap+json' }, signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      const j = await r.json();
      const ev = (j.events || []).find((e) => e.eventAction === 'registration');
      if (ev) dias = Math.floor((agora - new Date(ev.eventDate)) / 86400000);
    }
  } catch { /* sem rede ou sem RDAP: fica null e o score trata como "desconhecida" */ }
  cache.set(dominio, dias);
  return dias;
}
