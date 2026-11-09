// Cliente mínimo da API do Telegram (grátis, sem limite de mensagens além de ~30/s no total e 1/s por pessoa).
// O token vem de TELEGRAM_TOKEN (variável de ambiente). Nunca escreva o token no código.

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

// Foto local (caminho no disco, sem http) vai como arquivo; o resto vai em JSON.
async function corpo(params) {
  const local = typeof params.photo === 'string' && !/^https?:\/\//.test(params.photo) && !/^[A-Za-z0-9_-]{30,}$/.test(params.photo);
  if (!local) return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(params) };
  const f = new FormData();
  for (const [k, v] of Object.entries(params)) {
    if (k === 'photo') f.append('photo', new Blob([await readFile(v)]), basename(v));
    else f.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  return { body: f };
}

export function criarTelegram(token = process.env.TELEGRAM_TOKEN, fetchFn = fetch) {
  if (!token) throw new Error('Falta TELEGRAM_TOKEN (variável de ambiente).');
  const base = `https://api.telegram.org/bot${token}/`;
  async function chamar(metodo, params = {}) {
    const r = await fetchFn(base + metodo, { method: 'POST', ...(await corpo(params)) });
    const j = await r.json().catch(() => ({ ok: false, description: 'resposta inválida' }));
    if (!j.ok) {
      // 429 = muitas mensagens: espera o tempo que o Telegram pedir e tenta uma vez.
      if (j.error_code === 429 && j.parameters?.retry_after) {
        await new Promise((ok) => setTimeout(ok, (j.parameters.retry_after + 1) * 1000));
        return chamar(metodo, params);
      }
      // "message is not modified" acontece ao tocar no mesmo botão duas vezes: não é erro.
      if (/not modified/i.test(j.description || '')) return null;
      const e = new Error(`Telegram ${metodo}: ${j.description}`); e.codigo = j.error_code; throw e;
    }
    return j.result;
  }
  return {
    chamar,
    async executar(chamadas) { for (const c of chamadas) await chamar(c.metodo, c.params); }
  };
}
