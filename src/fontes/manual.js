// Fonte manual: ofertas anotadas à mão (ou exportadas de uma planilha) num JSON de ofertas cruas.
// É o que existe hoje (17 ofertas do Mercado Livre de 07/11/2026). Não usa rede.
import { readFile } from 'node:fs/promises';

export const precisa = [];

export async function coletar({ entrada }) {
  if (!entrada) throw new Error('fonte manual: informe --entrada arquivo.json');
  const lista = JSON.parse(await readFile(entrada, 'utf8'));
  return lista.map((o) => ({ fonte: 'manual', ...o }));
}
