// "Loja" do bot no Supabase (schema robo), pela API REST com a service role.
// Precisa: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. O schema "robo" tem de estar exposto na API
// (Supabase → Settings → API → Exposed schemas → adicionar "robo").

export function criarLojaSupabase({ url = process.env.SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY, fetchFn = fetch } = {}) {
  if (!url || !chave) throw new Error('Falta SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.');
  const h = { apikey: chave, authorization: `Bearer ${chave}`, 'accept-profile': 'robo', 'content-profile': 'robo', 'content-type': 'application/json' };
  async function rest(caminho, { metodo = 'GET', corpo, prefer } = {}) {
    const r = await fetchFn(`${url}/rest/v1/${caminho}`, { method: metodo, headers: { ...h, ...(prefer ? { prefer } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
    if (!r.ok) throw new Error(`Supabase ${metodo} ${caminho.split('?')[0]}: ${r.status} ${await r.text()}`);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  const um = (l) => (Array.isArray(l) ? l[0] : l) || null;
  const ALVO_PADRAO = { termos: [], classes: ['imperdivel', 'otimo'], orcamento: null, cats: [] };

  return {
    async assinantePorChat(chat) { return um(await rest(`assinantes?telegram_chat_id=eq.${chat}&ativo=eq.true&limit=1`)); },
    async vincular(appId, chat, nome) {
      // o mesmo Telegram só pode estar ligado a um app_id
      await rest(`assinantes?telegram_chat_id=eq.${chat}&app_id=neq.${encodeURIComponent(appId)}`, { metodo: 'PATCH', corpo: { telegram_chat_id: null } });
      return um(await rest('assinantes?on_conflict=app_id', { metodo: 'POST', corpo: { app_id: appId, telegram_chat_id: chat, nome }, prefer: 'resolution=merge-duplicates,return=representation' }));
    },
    async atualizarAssinante(id, campos) { await rest(`assinantes?id=eq.${id}`, { metodo: 'PATCH', corpo: campos }); },
    async alvo(id) {
      const a = um(await rest(`alvos_robo?assinante_id=eq.${id}&ativo=eq.true&order=id.desc&limit=1`));
      return a ? { id: a.id, termos: a.termos || [], classes: a.classes || ALVO_PADRAO.classes, orcamento: a.orcamento, cats: a.cats || [] } : { ...ALVO_PADRAO };
    },
    async salvarAlvo(id, campos) {
      const atual = await this.alvo(id);
      if (atual.id) await rest(`alvos_robo?id=eq.${atual.id}`, { metodo: 'PATCH', corpo: campos });
      else await rest('alvos_robo', { metodo: 'POST', corpo: { assinante_id: id, ...ALVO_PADRAO, ...campos } });
    },
    async vigiar(a, link, precoInicial) {
      await rest('vigiados?on_conflict=app_id,loja,id_loja', { metodo: 'POST', prefer: 'resolution=merge-duplicates',
        corpo: { app_id: a.app_id, assinante_id: a.id, loja: link.loja, id_loja: link.id, url: link.url, preco_inicial: precoInicial, avisar: true, ativo: true } });
    },
    async vigiados(id) {
      const l = await rest(`vigiados?assinante_id=eq.${id}&ativo=eq.true&select=id,loja,id_loja,url&order=id`);
      return l.map((v) => ({ ...v, nome: null }));
    },
    async pararVigiado(id, vid) { await rest(`vigiados?id=eq.${vid}&assinante_id=eq.${id}`, { metodo: 'PATCH', corpo: { ativo: false } }); },
    async produtoDoLink(link) {
      const o = um(await rest(`ofertas?url=eq.${encodeURIComponent(link.url)}&select=preco,preco_de,real,reputacao,vendedor_oficial,produto_id,loja_id,produtos(nome)&limit=1`));
      if (!o) return null;
      const h = await rest(`historico_precos?produto_id=eq.${o.produto_id}&loja_id=eq.${o.loja_id}&select=preco,coletado_em&order=coletado_em&limit=2000`);
      return { nome: o.produtos?.nome, preco: +o.preco, de: o.preco_de ? +o.preco_de : null, reputacao: o.reputacao, lojaOficial: o.vendedor_oficial,
        realVsMercado: o.real != null ? +o.real : null, historico: h.map((x) => ({ preco: +x.preco, em: x.coletado_em })) };
    },
    async relampagoHoje() {
      const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const l = await rest(`relampago?dia=eq.${hoje}&order=posicao&select=real,ofertas(url,preco,produtos(nome),lojas(nome))`);
      return l.map((r) => ({ nome: r.ofertas?.produtos?.nome, preco: +r.ofertas?.preco, real: +r.real, loja: r.ofertas?.lojas?.nome, url: r.ofertas?.url }));
    },
    // ---------- envio de alertas ----------
    async assinantesAtivos() { return rest('assinantes?ativo=eq.true&pausado=eq.false&telegram_chat_id=not.is.null&select=*'); },
    async alvosAtivos() { return rest('alvos_robo?ativo=eq.true&select=*'); },
    async ofertasAtuais() {
      const l = await rest(`ofertas?ativa=eq.true&classe=in.(imperdivel,otimo,bom)&select=id,url,url_afiliado,preco,referencia,real,classe,score,menor_90,outra_loja,outra_preco,produtos(chave,nome,cat),lojas(nome)&order=real.desc&limit=5000`);
      return l.map((o) => ({ chave: o.produtos?.chave, nome: o.produtos?.nome, cat: o.produtos?.cat, loja: o.lojas?.nome, url: o.url_afiliado || o.url, preco: +o.preco,
        referencia: +o.referencia, real: +o.real, classe: o.classe, score: o.score, menorEm90: o.menor_90, outra: o.outra_loja ? { loja: o.outra_loja, preco: +o.outra_preco } : null, ofertaId: o.id }));
    },
    async alertasEnviados(desdeISO) { return rest(`alertas_enviados?enviado_em=gte.${desdeISO}&select=assinante_id,produto_chave,preco,enviado_em`); },
    async registrarAlerta(a) { await rest('alertas_enviados', { metodo: 'POST', corpo: a }); }
  };
}
