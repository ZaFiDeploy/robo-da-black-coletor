# robo-da-black-coletor

Motor de oportunidades do Robô da Black. A lógica e as decisões estão em [LOGICA.md](LOGICA.md).
Node 20+ puro, sem dependências. Nada publicado, nada aplicado em banco.

```bash
npm test                 # 107 testes
npm run coletar:exemplo  # amostra real de 07/11 (17 ofertas ML) → saida/ofertas.json e saida/ofertas.js
```

| Arquivo | O que faz |
|---|---|
| `src/normalizar.js` | mesmo produto entre lojas: EAN > marca+modelo+versão > título; trava de atributo (128 GB ≠ 256 GB) |
| `src/preco.js` | mercado hoje (mediana sem extremos), histórico (mediana 60 d, mínimo 90 d), referência = o menor dos dois |
| `src/classificar.js` | Imperdível / Ótimo / Bom / Sem desconto / **Suspeito** ("de" que destoa do comum da loja ou que o produto nunca custou) / Falso / Sem dados; `motivo` = o porquê em uma linha |
| `src/score.js` | score de segurança 0–100 (domínio, imitação de marca, idade, Pix, preço bom demais, reputação) |
| `src/rdap.js` | idade do domínio por RDAP público (registro.br / rdap.org), com cache |
| `src/antes-depois.js` | Caça Black Fraude: antes x agora do produto vigiado (caiu / igual / subiu / maquiagem) |
| `src/links.js` | link colado → loja + id (ML, Amazon, Shopee, KaBuM!, Magalu, Americanas, encurtados) |
| `src/relampago.js` | 5 por dia |
| `src/alerta.js` | quem recebe qual alerta no Telegram + texto da mensagem |
| `src/motor.js` | junta tudo: agrupa, avalia, escolhe Relâmpago; 1 outra loja vira referência `loja_unica` (dita como "1 loja comparada", nunca Relâmpago) |
| `src/exportar.js` | formato `RB_OFERTAS` do app (+ campos novos) |
| `src/coletor.js` | CLI: fontes → motor → `saida/`; coleta de sitemap também grava `amostras/<loja>-sitemap-<dia>.json` e a fotografia `amostras/historico/<dia>T<hora>-<loja>.json` |
| `src/robots.js` | lê o robots.txt e decide se um caminho é permitido para o nosso robô |
| `src/jsonld.js` | lê Product/Offer/BreadcrumbList do JSON-LD de uma página |
| `src/categorias-fonte.js` | categoria de qualquer loja/feed → `cat`/`top` do app |
| `src/fontes/sitemap.js` | **sitemap educada**: robots + sitemap + JSON-LD, 1 pedido/1,5 s, para no 1º bloqueio. Lojas validadas: KaBuM!, Americanas, Carrefour, Cobasi, Tok&Stok, Polishop, Ri Happy, Decathlon, Renner (teto 600 páginas/loja/dia); "de" das lojas VTEX/Renner lido do JSON da página (`dePorChave`, corte de 5%) |
| `scripts/sondar-sites.js` | sondagem educada de uma lista de sites (robots, sitemap, 1 página) → quem permite robô |
| `src/fontes/lomadee.js` / `impact.js` / `tiktok.js` | esboços das redes de afiliado (pulam sem chave) — não validados |
| `src/fontes/vtex-busca.js` | **busca cruzada**: procura o mesmo produto da vitrine em outra loja VTEX com catálogo público (Americanas, Ri Happy, Cobasi), por EAN ou marca+modelo validado pelo normalizador; robots + UA honesto + 1 pedido/1,5 s, para no 1º 403 |
| `scripts/cruzar-vtex.js` | CLI da busca cruzada → `amostras/cruzado-<loja>-<data>.json` (grava aos poucos; não repete o que já fez no dia) |
| `src/fontes/manual.js` | JSON de ofertas anotadas à mão (funciona hoje) |
| `src/fontes/mercadolivre.js` | API ML com token (precisa `ML_CLIENT_ID`/`ML_CLIENT_SECRET`) — não validado |
| `src/fontes/shopee.js` | Shopee Affiliate GraphQL (precisa `SHOPEE_APP_ID`/`SHOPEE_SECRET`) — não validado |
| `src/fontes/awin.js` | feeds CSV da Awin, ex. KaBuM! (precisa `AWIN_FEED_KEY`) — não validado |
| `sql/001_esquema.sql` | schema `robo` para um Supabase próprio — testado só em Postgres local descartável |
| `sql/002_vigiados.sql` | produtos que cada pessoa colou para vigiar — idem |
| `scripts/amostra-de-datajs.js` | converte o `data.js` do app em amostra crua |
| `scripts/importar-ml-ofertas.js` | coleta do ML (texto `T|…`/`C|…` vinda do Chrome) → ofertas cruas + taxonomia |
| `scripts/gerar-ofertas-app.js` | junta todas as coletas de `amostras/` (+ `cruzado-*.json` como preço de outra loja e `historico/*.json` como histórico) → `../robo-da-black/dados/` (indice.json + 1 JSON por departamento) e `ofertas-ml.js` (reserva) |
| (fim do `gerar-ofertas-app.js`) | chama `../robo-da-black-telegram/publicar.sh` em segundo plano: gera os dados do app Ofertas do Telegram e publica na Vercel se mudou (log em `publicar.log`; `SEM_TELEGRAM=1` pula) |
| `scripts/publicar-storage.js` | sobe `dados/` para o Supabase Storage (precisa SUPABASE_URL + SERVICE_ROLE) |
| `.github/workflows/` | `coletar.yml` (APIs, de hora em hora), `feeds.yml` (2×/dia), `sitemaps.yml` (1×/dia) — rodam quando o repositório estiver no GitHub e com segredos |
| `PLANO-DE-NEGOCIO.md` | fontes lícitas, metas, custo zero, cronograma, tarefas do Milton |
| `scripts/receber.js` | receptor local (POST → arquivo) usado para trazer a coleta do Chrome |
| `src/departamentos.js` | departamentos = categorias de topo do ML + atalhos; subcategorias escritas |
| `scripts/gerar-caca-browser.js` | gera `../robo-da-black/caca.js` (links + antes x agora + score) para o app; rodar de novo sempre que mudar essas regras |

Fonte sem chave é pulada com aviso: `node src/coletor.js --fonte manual --fonte mercadolivre --entrada …`.
