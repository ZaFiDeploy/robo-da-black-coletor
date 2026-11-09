// Sobe os JSONs de uma pasta para o bucket público "ofertas" do Supabase Storage (service role; sem dependências).
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE=... node scripts/publicar-storage.js saida/dados
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const [pasta] = process.argv.slice(2);
const url = process.env.SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE, bucket = process.env.SUPABASE_BUCKET || 'ofertas';
if (!url || !chave) { console.log('sem SUPABASE_URL/SERVICE_ROLE: não publico'); process.exit(0); }
for (const nome of (await readdir(pasta)).filter((n) => n.endsWith('.json'))) {
  const r = await fetch(`${url}/storage/v1/object/${bucket}/${nome}`, {
    method: 'POST', headers: { authorization: `Bearer ${chave}`, 'content-type': 'application/json', 'x-upsert': 'true', 'cache-control': 'max-age=300' },
    body: await readFile(join(pasta, nome))
  });
  console.log(nome, r.status, r.ok ? 'ok' : await r.text());
}
