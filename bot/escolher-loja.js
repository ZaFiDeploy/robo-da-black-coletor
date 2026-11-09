// Onde o bot guarda: Supabase quando existir; senão o Vercel Blob privado do projeto do bot.
import { criarLojaSupabase } from './loja-supabase.js';
import { criarLojaBlob } from './loja-blob.js';

export function criarLoja() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return criarLojaSupabase();
  return criarLojaBlob();
}
