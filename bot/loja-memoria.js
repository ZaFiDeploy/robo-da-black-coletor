// "Loja" em memória: mesma interface da loja do Supabase. Usada nos testes e no simulador.
// Os dados de exemplo são as ofertas reais checadas em 07/11/2026 (Mercado Livre) + um produto
// com histórico inventado SÓ para demonstrar o veredito "Black Fraude" (marcado como exemplo).

export function criarLojaMemoria({ produtos = PRODUTOS_EXEMPLO, relampago = RELAMPAGO_EXEMPLO } = {}) {
  const assinantes = [], alvos = new Map(), vigiados = [];
  let seq = 1;
  return {
    async assinantePorChat(chat) { return assinantes.find((a) => a.telegram_chat_id === chat) || null; },
    async vincular(appId, chat, nome) {
      let a = assinantes.find((x) => x.app_id === appId);
      if (!a) { a = { id: seq++, app_id: appId, plano: 'completo', pausado: false, silencio_noite: true, estado: '{}', nome }; assinantes.push(a); }
      assinantes.forEach((x) => { if (x !== a && x.telegram_chat_id === chat) x.telegram_chat_id = null; });
      a.telegram_chat_id = chat; a.nome = nome || a.nome;
      return a;
    },
    async atualizarAssinante(id, campos) { Object.assign(assinantes.find((a) => a.id === id), campos); },
    async alvo(id) { return alvos.get(id) || { termos: [], classes: ['imperdivel', 'otimo'], orcamento: null, cats: [] }; },
    async salvarAlvo(id, campos) { alvos.set(id, { ...(await this.alvo(id)), ...campos }); },
    async vigiar(a, link, precoInicial) {
      if (vigiados.some((v) => v.assinante_id === a.id && v.loja === link.loja && v.id_loja === link.id && v.ativo)) return;
      const p = produtos.find((x) => x.loja === link.loja && x.id === link.id);
      vigiados.push({ id: seq++, assinante_id: a.id, app_id: a.app_id, loja: link.loja, id_loja: link.id, url: link.url, nome: p?.nome || null, preco_inicial: precoInicial, ativo: true });
    },
    async vigiados(id) { return vigiados.filter((v) => v.assinante_id === id && v.ativo); },
    async pararVigiado(id, vid) { const v = vigiados.find((x) => x.id === vid && x.assinante_id === id); if (v) v.ativo = false; },
    async produtoDoLink(link) { return produtos.find((x) => x.loja === link.loja && x.id === link.id) || null; },
    async relampagoHoje() { return relampago; },
    // usados pelo envio de alertas
    async assinantesAtivos() { return assinantes.filter((a) => a.telegram_chat_id && !a.pausado); },
    async ofertasAtuais() { return OFERTAS_EXEMPLO; },
    async alertasEnviados() { return []; },
    async registrarAlerta() {},
    _dados: { assinantes, alvos, vigiados }
  };
}

const dias = (n, preco) => ({ preco, em: new Date(Date.now() - n * 86400000).toISOString() });

export const PRODUTOS_EXEMPLO = [
  // Real (07/11): sem histórico próprio ainda → "Anotado, vou vigiar".
  { loja: 'mercadolivre', id: 'MLB24047848', nome: 'Secadora Electrolux 11 kg Essential Care STL11', preco: 1529.15, de: 1699, historico: [] },
  // EXEMPLO de demonstração (histórico fictício): subiu e "baixou" de volta = Black Fraude.
  { loja: 'mercadolivre', id: 'MLB99999999', nome: 'Air fryer 5 L (exemplo)', preco: 1019.9, de: 1999.9,
    historico: [dias(12, 999.9), dias(11, 999.9), dias(10, 1009.9), dias(8, 1349.9), dias(6, 1349.9), dias(4, 1349.9), dias(2, 1349.9)] }
];

export const RELAMPAGO_EXEMPLO = [
  { nome: 'Secadora Electrolux 11 kg Essential Care STL11', preco: 1529.15, real: 0.43, loja: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/p/MLB24047848' },
  { nome: 'Lava-roupas líquido Tixan Ypê Primavera 7 L', preco: 47.49, real: 0.43, loja: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/p/MLB19466433' },
  { nome: 'Inversor veicular 350W 12V Defqual IF-378', preco: 89, real: 0.27, loja: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/p/MLB62888640' },
  { nome: 'Câmera Wi-Fi externa TP-Link Tapo C320WS 2K', preco: 191.2, real: 0.26, loja: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/p/MLB19693785' },
  { nome: 'Lavadora de alta pressão Kärcher Compacta', preco: 274.55, real: 0.17, loja: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/p/MLB40583845' }
];

export const OFERTAS_EXEMPLO = [
  { chave: 'mercadolivre:MLB24047848', nome: 'Secadora Electrolux 11 kg Essential Care STL11', cat: 'eletro', loja: 'Mercado Livre', preco: 1529.15, referencia: 2699, real: 0.43, classe: 'imperdivel', score: 92, url: 'https://www.mercadolivre.com.br/p/MLB24047848' },
  { chave: 'mercadolivre:MLB62888640', nome: 'Inversor veicular 350W 12V Defqual IF-378', cat: 'automotivo', loja: 'Mercado Livre', preco: 89, referencia: 122.55, real: 0.27, classe: 'otimo', score: 80, url: 'https://www.mercadolivre.com.br/p/MLB62888640' }
];
