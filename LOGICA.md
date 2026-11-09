# Robô da Black: lógica do motor de oportunidades

07/11/2026. Formato: **dado → conclusão → decisão**. `[X]` = número que eu não sei e não inventei.
O código desta pasta já implementa as regras de 0, 2, 3, 4 e 7 (ver `README.md`).

---

## 0. A promessa: "CAÇA BLACK FRAUDE"

> *Compare o preço do produto que você deseja comprar antes e depois da Black para saber se o desconto é de verdade.* (Milton, 07/11)

**Dado:** a promessa muda o centro do produto. Antes era uma vitrine de ofertas escolhidas por nós; agora é **o produto que a pessoa quer**, comparado **antes x agora**. Para isso existir, alguém precisa ter guardado o preço de antes. Nosso histórico começa no dia em que o coletor liga: no melhor caso, 07/11. E a Black já começou.
**Conclusão:**
1. O "antes" de cada produto é **o preço desde o dia em que começamos a vigiá-lo**. Antes disso não temos nada. Quem cola o link hoje terá ~20 dias de "antes" no dia 27/11; quem cola no dia 26 não terá veredito pelo histórico (fica só a comparação com as outras lojas no dia).
2. O golpe que a promessa caça é a **maquiagem**: a loja sobe o preço em novembro e "baixa" na Black de volta ao preço de antes (padrão descrito pelo Procon-SP). Isso só aparece olhando a série de preços, e é exatamente o que a régua abaixo detecta.
3. Fontes de preço de antes de novembro existem, mas nenhuma está garantida: snapshots públicos do Internet Archive (cobertura irregular, `[X]`) e Keepa para a Amazon (pago, preço `[X]`).

**Decisão** (`src/antes-depois.js`, `src/links.js`, `sql/002_vigiados.sql`):
- **Entrada:** a pessoa cola o link (ML, Amazon, Shopee, KaBuM!, Magalu, Americanas; link de outro site vai para o score de segurança). O link vira um item em `robo.vigiados` e o coletor passa a buscar aquele item em toda rodada (uma vez por item, não por pessoa).
- **Antes** = mediana do menor preço de cada dia vigiado (até 45 dias, sem contar hoje). Vale a partir de **5 dias** vigiando; antes disso a resposta é "Começamos a vigiar em DD/MM. Em N dias mostramos o antes e o agora."
- **Vereditos**, com a frase pronta para o app e o Telegram:

| Veredito | Regra | Frase (exemplo) |
|---|---|---|
| Caiu de verdade | agora ≥ 5% abaixo do antes | "Caiu 20% de verdade: custava R$ 1.000,00, agora R$ 800,00." |
| Mesmo preço | ±5% | "Mesmo preço de antes (R$ 1.000,00). O "-45%" da loja é falso." |
| Mais caro | agora ≥ 5% acima | "Está 10% mais caro que antes (R$ 1.000,00)." |
| **Black Fraude (maquiagem)** | subiu ≥ 10% depois dos 3 primeiros dias e "baixou" de volta para ±5% do preço do começo | "Black Fraude: subiu de R$ 1.000,00 para R$ 1.300,00 e "baixou" para R$ 1.010,00. Na prática, é o preço de antes." |

- **Consequência para a operação:** quanto antes as pessoas colarem os links, mais forte é a prova na Black. A vitrine (seções 2 e 3) continua como "o que vale a pena hoje"; o Caça Black Fraude é "o que eu quero comprar, vale a pena?".
- **Recomendação de copy** (a página é de outra sessão; não editei): a headline promete "antes e depois da Black", mas o "antes" começa quando a pessoa cola o link. Uma linha de apoio do tipo *"cole o link agora: a gente vigia o preço todo dia e na Black mostra se o desconto é de verdade"* deixa a promessa verdadeira e ainda cria urgência para entrar antes da Black.

---

## 1. Fontes

| Fonte | Dado (pesquisa de 07/11/2026) | Conclusão | Decisão |
|---|---|---|---|
| **Mercado Livre** | Sem token, testei hoje: `/sites/MLB/search` → 403, `/products/search` → 403 (PolicyAgent), `/products/{id}` → **401 "authorization value not present"** (pede token, não bloqueia). Vários devs relatam o 403 da busca **mesmo com token** desde 2026. O programa de afiliados não tem API pública documentada para gerar links. | Busca aberta morreu. Ficha do produto do catálogo (`/products/{id}`: preço do vencedor da vitrine, GTIN, marca, modelo) provavelmente funciona com token de app. | **Fonte nº 1.** Milton cria um app de desenvolvedor (grátis). O coletor lê uma lista curada de IDs de catálogo (`MLB…`) por categoria. Link de afiliado: gerado no painel, à mão, só para o Relâmpago e o Top da vitrine. Validar `/products/{id}` no 1º dia com token. |
| **Shopee** | Open API de afiliados em GraphQL (`open-api.affiliate.shopee.com.br/graphql`, consulta `productOfferV2`), assinatura SHA256 com AppID + Secret. Acesso passa por aprovação no painel. Docs encontradas são de terceiros. | Única fonte grande com **busca por palavra** e link de afiliado pronto. Prazo de aprovação `[X]`. | **Fonte nº 2.** Pedir acesso já. Adaptador escrito (`src/fontes/shopee.js`), não validado. |
| **Amazon** | PA-API 5 foi aposentada em 2026; a substituta é a **Creators API**. A doc oficial do Associados BR exige **10 vendas qualificadas nos últimos 30 dias** para liberar. | Sem vendas, sem API. Na Black 2026 a Amazon não entra como fonte automática. | Milton se cadastra no Associados já (grátis) e usa links de associado no Relâmpago; se bater 10 vendas, liga a API em 2027. Até lá a Amazon entra só como **comparação manual**. |
| **KaBuM!** | Programa na **Awin** (perfil 17729): CPA 2,30% (1P/2P) e 1,15% (marketplace), cookie de 1 dia, aceita pessoa física. Awin entrega **feed de produtos em CSV** com preço, preço antigo e EAN (lista de feeds pela "data feed key"). | Feed com EAN = casamento de produto de alta confiança e milhares de itens por arquivo. | **Fonte nº 3.** Cadastro na Awin + pedir KaBuM!. Adaptador escrito (`src/fontes/awin.js`), não validado. |
| **Magalu** | Um ator da Apify lista Magalu na Awin; o programa próprio (Parceiro/Influenciador Magalu) aceita CPF. Nada oficial sobre feed. | Incerto `[X]`. | Ver no painel da Awin se a Magalu aparece. Se não, Magalu fica fora da coleta automática. |
| **Casas Bahia** | Programa na Awin; a página da Lomadee diz "programa inativo"; a Wikipedia registra pedido de falência/recuperação em ago/2026. | Risco de programa parado. | Não priorizar. Só se aparecer aberto na Awin. |
| **Americanas** | Não achei programa com API ou feed confirmado. | `[X]` | Fora por agora. |
| **Lomadee** | Páginas contraditórias (marca listada x programa inativo); chave de API mencionada só por terceiros. | Não dá para planejar em cima. | Milton abre conta (grátis) só para ver o que tem; não bloqueia nada. |
| **AliExpress** | Affiliates API (`aliexpress.affiliate.product.query`) com App Key/Secret do Open Platform. Docs de terceiros divergem na assinatura. | Serve para itens baratos importados, pouco para "desconto real" na Black BR. | Depois da Black. |
| **Google Shopping** | É o que usei à mão em 07/11 para achar o preço nas outras lojas. Não há API oficial gratuita para buscar preço de terceiros; serviços pagos de SERP existem (preço `[X]`). | Comparar loja x loja automático, sem feed, custa dinheiro. | Não contratar agora. Comparação vem das fontes acima + histórico próprio. Revisar se faltar cobertura. |

**Ordem:** ML (token) → Shopee (aprovação) → Awin/KaBuM! (aprovação) → Amazon manual.

**Robô de scraping do site (pedido do Milton, 07/11): testado e descartado.**
- Dado: o `robots.txt` de mercadolivre.com.br tem `Disallow: /ofertas?` para todo robô; um pedido com identidade honesta (`robo-da-black-coletor/0.1`) à página de ofertas volta `302` para `/gz/account-verification`.
- Conclusão: raspar `/ofertas` por programa é contra a regra do site e cai no bloqueio. Disfarçar o robô de navegador seria driblar o bloqueio, e isso não fazemos.
- Decisão: as ofertas de hoje vieram do **Chrome do Milton** (páginas públicas que ele mesmo vê, lidas devagar, 684 em 22 departamentos). Isso serve para popular o app agora, não como motor diário. O caminho automático continua sendo a **API oficial com token** (fichas de produto) e os **feeds de afiliado** (Awin, Shopee).
Nada de scraping de páginas com verificação anti-robô: o `curl` em mercadolivre.com.br cai em verificação de conta e isso fica como está.

---

## 2. Desconto real

**Dado:** Timelens (Black 2025, 2.373 produtos, 809 mil observações): **45,4% sem desconto efetivo**, só **16,1% com queda acima de 15%**. Procon-SP descreve o padrão de subir o preço antes da Black e "baixar" depois.

**Conclusão:** o "de" da loja não serve como referência. E histórico curto (que começa em novembro) pode já estar inflado.

**Decisão: régua conservadora, o desconto real é o MENOR dos dois descontos** (`src/preco.js`):

1. **Mercado hoje** = mediana do mesmo produto em **≥ 2 outras lojas** no dia, uma observação por loja (a menor), cortando 20% de cada ponta quando há 5 ou mais preços.
2. **Histórico próprio** = menor preço de cada dia; **mediana de 60 dias** (vale com ≥ 14 dias observados) e **mínimo de 90 dias** (selo "menor preço em 90 dias").
3. **Referência** = o menor entre (1) e (2) quando existem os dois; senão o que existir; nenhum → "sem dados", não aparece.

Consequência prática: para ter histórico no dia 27/11, **o coletor precisa estar rodando até 13/11** (14 dias). Mediana de 60 dias de verdade só em 2027.

**Mesmo produto entre lojas** (`src/normalizar.js`):
- **EAN/GTIN** válido (confere o dígito verificador) → confiança alta.
- **Marca + modelo + versão** (`mod:samsung|a36|128gb,6gb`) → média. Modelo = código que mistura letra e número (STL11, C320WS, UN85C).
- **Título normalizado** (sem acento, sem palavras de vitrine, unidades padronizadas: "128 GB" = "128gb", "12.000 BTUs" = "12000btu", 50" = "50pol") com similaridade ≥ 0,6 → baixa.
- **Trava:** armazenamento, potência, tamanho, volume ou voltagem diferentes **nunca** casam (128 GB ≠ 256 GB; 110 V ≠ 220 V).

---

## 3. Classes (`src/classificar.js`, mesma régua do app)

| Classe | Regra |
|---|---|
| Imperdível | real ≥ 30% |
| Ótimo preço | real ≥ 15% |
| Bom preço | real ≥ 5% |
| **Desconto falso** | loja anuncia ≥ 10% **e** real < 5% |
| Sem desconto real | real < 5% sem anúncio inflado → **não vai para a vitrine** |
| Sem dados | sem referência → não vai para a vitrine |

**Dado:** rodando o motor nas 17 ofertas reais de 07/11 → 2 Imperdíveis, 4 Ótimos, 4 Bons, 7 Falsos; bate 17/17 com a régua que o app usa hoje (teste `motor.test.js`).
**Diferença em relação ao app:** o app hoje chama de "Bom" qualquer coisa abaixo de 5% que não seja falsa; o motor separa "sem desconto" e não manda para o app.

---

## 4. Score de segurança 0–100 (`src/score.js`)

**Dado:** os golpes da Black são site falso imitando loja grande, site recém-criado, preço bom demais e pagamento só por Pix.
**Conclusão:** o risco está na loja/endereço, não no produto. Dá para medir quase tudo sem login: domínio, idade do domínio (RDAP público: `rdap.registro.br`, testado hoje), cadeado, preço vs mercado.

**Fórmula:** ponto de partida pelo canal, menos penalidades, com travas.

| Ponto de partida | |
|---|---|
| Loja oficial / site da própria varejista grande | 95 |
| Marketplace grande, vendedor reputação alta | 88 |
| Marketplace grande, reputação média **ou desconhecida** | 72 |
| Marketplace grande, vendedor novo | 55 |
| Marketplace grande, reputação baixa | 40 |
| Site fora da lista de grandes | 60 |

| Penalidade | Pontos |
|---|---|
| Endereço imita marca (magalu-ofertas.shop, mercadolivere.com) | −45 e **trava em 15** |
| Site com menos de 30 dias | −40 e **trava em 25** |
| Site com menos de 180 dias / 1 ano / idade desconhecida | −20 / −10 / −10 |
| Só aceita Pix | −25 (site independente: **trava em 35**) |
| Preço ≥ 60% abaixo do mercado / ≥ 45% | −35 / −15 |
| Sem https | −30 |
| Final suspeito (.shop, .xyz, .online, .top…) | −10 |
| Sem CNPJ visível (site independente) | −10 |

**Faixas:** 80–100 Seguro · 60–79 Atenção · 40–59 Cuidado · 0–39 Evite.
**Decisão:** vitrine só com score ≥ 60; Relâmpago ≥ 80 (completa com ≥ 70 se faltar); robô só avisa ≥ 60. O mesmo score atende o **"detector de fraude"** do plano R$ 19,90: o comprador cola um link, o app devolve nota + motivos.
**Furo atual:** as 17 ofertas manuais não têm reputação do vendedor anotada → todas ficaram em 72. A reputação vem da API (ML: vendedor do buy box; Shopee: tipo de loja e nota) `[a validar]`.

---

## 5. Volume: "+50.000 promoções ao vivo, atualizadas a cada hora"

**Dado:**
- Hoje existem **17** ofertas checadas, à mão.
- ML por ficha de produto: 1 chamada por produto. A 2 por segundo (ritmo leve que adotei) são ~7.200 fichas por hora. Limite oficial de chamadas do ML para app `[X]`.
- Feeds da Awin trazem o catálogo inteiro do anunciante num arquivo; frequência de atualização do feed de cada loja `[X]` (costuma ser diária, conferir no painel).
- Shopee: paginação e limite de chamadas `[X]` (terceiros falam em 500 por página).
- Timelens: só 16,1% das ofertas tiveram queda acima de 15%.

**Conclusão:**
- **50.000 produtos monitorados** é alcançável **só com feeds aprovados** (Awin) + Shopee. Com ML sozinho, não.
- **50.000 atualizados a cada hora** não é realista na Black 2026: feeds são diários `[X]` e a API do ML por item não dá 50 mil/hora.
- **50.000 com desconto real** não existe: se a proporção da Timelens se repetir, de 50 mil monitorados uns 8 mil teriam queda acima de 15% (estimativa, não medição).

**Decisão / recomendação:**
1. A página de vendas deveria dizer **"+50.000 produtos monitorados"** (e só quando a contagem real passar disso), não "promoções ao vivo". *Não editei a página; outra sessão cuida dela.*
2. Atualização em duas velocidades: **de hora em hora** para o que está na vitrine e nos alvos do robô (estimo ~2 a 5 mil itens, cabe no ritmo do ML), **1 a 2 vezes por dia** para o resto do catálogo (feeds).
3. Meta realista para 27/11: algumas centenas a poucos milhares de oportunidades checadas na vitrine, dependendo das aprovações `[X]`.

---

## 6. Arquitetura

```
GitHub Actions (cron)          Supabase próprio "robo-da-black"           Saídas
───────────────────            ───────────────────────────────           ───────────────────────
coletor ML    (de hora em hora) ─┐  robo.produtos / lojas / ofertas       ofertas.json no Storage
coletor Shopee(de hora em hora) ─┼─►robo.historico_precos (trigger)  ──►  (o app lê; cache de CDN)
coletor Awin  (2x por dia)      ─┘  robo.relampago                         
motor (preço, classe, score)        robo.assinantes / alvos_robo     ──►  Bot Telegram (Edge Function:
                                    robo.alertas_enviados                  webhook /start + envio)
```

- **Banco:** `sql/001_esquema.sql` (schema `robo`). Testado num Postgres local descartável, **não aplicado em nenhum Supabase**. Histórico grava só quando o preço muda **ou** no 1º registro do dia (testado: 3 linhas para insert + dia novo + mudança de preço). View `robo.preco_diario` = menor preço por dia.
- **Coletor:** Node puro, sem dependências (`src/coletor.js`). Roda no GitHub Actions. Repositório **privado** no plano Free tem 2.000 min/mês; 24 rodadas × ~3 min × 30 dias ≈ 2.160 min → passa do limite. Opções: repositório público (o código fica aberto, as chaves não) ou rodadas a cada 2 h `[decisão do Milton]`.
- **App** (estático na Vercel): lê `ofertas.json` publicado no Storage a cada rodada. Não consulta o banco → aguenta pico da Black sem custo extra. Fica com `data.js` como reserva se o JSON não carregar.
- **Bot:** criado no BotFather (grátis). Webhook numa Edge Function do Supabase recebe o `/start <id-do-app>` e grava o `chat_id`. Depois de cada coleta, `planejarAlertas()` decide quem recebe o quê (máx. 8 por pessoa por dia, reaviso só se cair mais 5%).
- **Custo mensal:** Supabase Free (500 MB) aguenta a Black: estimo ~1 milhão de linhas de histórico com 50 mil produtos em 20 dias, ~120 MB (estimativa de ~120 bytes por linha com índice). Supabase Pro US$ 25/mês só se passar disso ou para backups. GitHub Actions R$ 0 (com a escolha acima). Telegram R$ 0. **Total na Black: R$ 0 a US$ 25.**

---

## 7. Como é mostrado

**Cada oferta entrega ao app** (`src/exportar.js`, compatível com `RB_OFERTAS` de hoje):
`id` (número estável), `nome`, `cat`, `loja`, `preco`, `de`, `mercado` (= referência escolhida), `lojas`, `outra {loja, preco}` (se mais barato em outro lugar), `relampago`, `url`, `img`
\+ novos: `classe`, `real`, `base` ("mercado" ou "historico"), `menorEm90`, `score`, `faixa`, `checadoEm`.
O coletor gera `saida/ofertas.js` (drop-in: `window.RB_OFERTAS = …`) e `saida/ofertas.json`.

**Relâmpago** (`src/relampago.js`): 5 por dia = maiores quedas reais entre Imperdível/Ótimo, score ≥ 80 (completa com ≥ 70), no máximo 2 por categoria, 1 por produto; empate vai para quem caiu nas últimas 24 h. Grava em `robo.relampago` (fixo no dia, o app sorteia a ordem do giro).

**Alerta do Telegram** (`src/alerta.js`, HTML; exemplo real da amostra de 07/11, gerado pelo motor; a linha "📉 Menor preço dos últimos 90 dias" entra quando houver histórico e "⚠️ Em [loja] está R$ X" quando outra loja estiver mais barata):
```
🔥 IMPERDÍVEL
Secadora Electrolux 11 kg Essential Care STL11
R$ 1.529,15 · Mercado Livre
43% abaixo do preço comum (R$ 2.699,00).
🛡️ Segurança 72/100
Ver na loja →
```

---

## 7b. Vitrine povoada (07/11, tarde)

- **Dado:** 684 ofertas coletadas em mercadolivre.com.br/ofertas pelo Chrome (22 categorias de topo, até 10 subcategorias cada, 6 a 8 ofertas por subcategoria), com título, preço, preço "de", foto, categoria e subcategoria do próprio ML. Depois de tirar repetidas e as 17 já checadas: **621 novas** → `robo-da-black/ofertas-ml.js` (gerado por `scripts/gerar-ofertas-app.js`, 325 KB).
- **Conclusão:** essas 621 não têm preço de outras lojas ainda. Mostrar o "-X%" da loja como desconto real seria mentir.
- **Decisão:** classe **"nao_checado"**: a carta mostra o preço, o "de" riscado, um "?" no lugar do desconto real e o aviso "ainda não comparamos com outras lojas". Entram na aba "A checar", nunca em Oportunidades nem no Relâmpago, e o robô do Telegram não as usa. Viram checadas conforme o motor tiver comparação (API com token ou histórico próprio).
- **Departamentos = os do Mercado Livre** (ids reais lidos do filtro de /ofertas): 22 categorias de topo + 4 atalhos (Oportunidades, Feminino, Masculino, Infantil), com **subcategorias escritas** como o seletor do ML (`src/departamentos.js` → `subcategorias()`; as 8 maiores na tela e "Ver todas" em painel).

## 7c. Máximo de ofertas, de forma lícita (07/11, noite) — ver `PLANO-DE-NEGOCIO.md`

- **Dado:** robots.txt lidos em 14 sites. Permitem robô em página de produto: KaBuM! (sitemap por categoria, JSON-LD com preço), Americanas, Carrefour. Proíbem ou bloqueiam o robô honesto: Mercado Livre (`/ofertas?`), Shopee (robots só para Google), Magalu/Casas Bahia (403), Netshoes (403). Teste real: KaBuM! 1.487 produtos em 1.500 páginas (59 min), sem bloqueio; Americanas 8/40 (muitos sem estoque) e Carrefour 19/40, com GTIN. App em 07/11 à noite: 2.152 produtos monitorados em 4 lojas, 1.832 na vitrine, 17 checadas.
- **Decisão:** fonte **sitemap educada** (`src/robots.js` + `src/jsonld.js` + `src/fontes/sitemap.js`): lê o robots, só segue caminho permitido, UA honesto, 1 pedido/1,5 s (ou Crawl-delay), para no 1º 403/429/captcha. Esboços de Lomadee, impact.com e TikTok Shop (pulam sem chave). Mapa de categorias por fonte (`src/categorias-fonte.js`). Saída por departamento (`dados/indice.json` + 1 JSON por `top`) e workflows do GitHub Actions (APIs de hora em hora, feeds 2×/dia, sitemaps 1×/dia; repositório público = R$ 0).
- **Metas honestas:** 12/11: 3–5 mil monitoradas (token ML + sitemaps); 19/11: 10–20 mil (Awin + Shopee aprovadas); 27/11: 20–50 mil com 3 mil+ checadas. Página: "N ofertas monitoradas" com o número real.

## 8. O que falta (contas, chaves, decisões)

**Milton cria (grátis, sem gastar):**
1. **App de desenvolvedor do Mercado Livre** (developers.mercadolivre.com.br) → `ML_CLIENT_ID` e `ML_CLIENT_SECRET`. *Primeiro, porque destrava o teste de `/products/{id}` e o histórico.*
2. **Afiliado Shopee + pedido da Open API** (affiliate.shopee.com.br) → `SHOPEE_APP_ID` e `SHOPEE_SECRET`.
3. **Publisher na Awin** + pedir **KaBuM!** (e ver se Magalu está lá) → `AWIN_FEED_KEY` (data feed key, não é a API key). Taxa de cadastro de publisher na Awin `[X]`, conferir antes.
4. **Associados Amazon** (links de associado; API só com 10 vendas em 30 dias).
5. **Afiliado Mercado Livre** (links do Relâmpago).
6. **Projeto Supabase próprio** "robo-da-black" (não usar banco de outra operação).
7. **Bot no BotFather** → nome do bot (vai em `BOT_TELEGRAM` do app) e token.

**Decisões do Milton:**
- A. Mudar a promessa da página para "+50.000 produtos monitorados"? *(recomendo sim)*
- B. Repositório do coletor público (Actions de hora em hora grátis) ou privado (de 2 em 2 h)? *(recomendo público: o código não vale nada sem as chaves)*
- C. Lista inicial de produtos a vigiar por missão (≈ 200 IDs do ML) — eu monto e ele aprova.
- D. Ligar o app ao `ofertas.json` (plano abaixo) — só depois do ok.

- E. A vitrine continua junto do Caça Black Fraude (colar o link) ou o colar link vira a tela principal do app? *(recomendo colar link como tela principal e vitrine logo abaixo: é o que a headline promete)*

**Plano para ligar o app (não executado):** no `index.html` do app, carregar `ofertas.js` publicado **depois** do `data.js`; o app passa a ler `classe`/`score` do motor em vez de recalcular; a carta ganha o selo de segurança; `poolRel()` usa o `relampago` do motor. Mudança pequena, `data.js` continua como reserva. Para o Caça Black Fraude: campo "cole o link" → grava em `robo.vigiados` (Edge Function) → mostra a frase de `compararAntesDepois()` e o gráfico da série diária; o robô avisa no Telegram quando o veredito virar "caiu".

---

Fontes: [Creators API (Associados BR)](https://associados.amazon.com.br/creatorsapi/docs/en-us/introduction) · [PA-API aposentada](https://blog.freshstore.com/amazon-creators-api-pa-api-retirement/) · [403 da busca do ML (Reclame Aqui)](https://www.reclameaqui.com.br/mercado-livre/erro-403-no-endpoint-sites-mlb-search-da-api-do-mercado-livre-impactando-a_9Ltak28lvD2yZJeY/) · [ML afiliados sem API pública](https://www.reclameaqui.com.br/mercado-livre/programa-de-afiliados-do-mercado-livre-nao-tem-uma-api_-lfESpIamuDGm2ro/) · [Shopee Affiliate (SDK .NET)](https://libraries.io/nuget/Shopee.Affiliate) · [Shopee Affiliate (doc de terceiros)](https://www.affiliateshopee.com.br/documentacao) · [KaBuM! na Awin](https://ui.awin.com/merchant-profile/17729) · [Feeds da Awin](https://help.awin.com/docs/product-feed-list-download) · [Casas Bahia na Lomadee](https://www.lomadee.com.br/en/brands/casasbahia) · [Casas Bahia (Wikipedia)](https://en.wikipedia.org/wiki/Casas_Bahia) · [AliExpress Affiliate (terceiros)](https://pypi.org/project/py-aliexpress-affiliate/) · [Timelens, Black 2025](https://mercadoeconsumo.com.br/16/10/2026/ecommerce/black-friday-45-dos-produtos-nao-tiveram-desconto-real-em-2025-aponta-estudo/amp/)
