# Jackbot no Telegram

O robô do Robô da Black dentro do Telegram. Usa as mesmas regras do motor (`src/`), sem cópia.

## O que ele faz

| Na conversa | O que acontece |
|---|---|
| `/start <id do app>` | Liga o Telegram à pessoa do app, manda a foto do Jackbot e pergunta o que ela quer comprar |
| Toca numa sugestão (Air fryer, iPhone…) ou escreve um nome | Vira alvo: o Jackbot vigia esse termo |
| Cola um link de produto | Checa: antes × agora (Black Fraude se o "de" foi inflado), nota de segurança 0–100 do site e, sem histórico, passa a vigiar o link |
| `/relampago` | As 5 maiores quedas reais de hoje |
| `/ajustes` | Quando avisar (só imperdível / ótimo+ / todo desconto real), silêncio à noite, pausar |
| `/pausar` · `/voltar` | Para e volta os alertas |

Alertas: `bot/enviar-alertas.js` roda depois de cada coleta. Máx. 8 por pessoa/dia, reaviso só se cair mais 5%, score ≥ 60, das 22h às 8h só imperdível.

## 0. Ligar agora (08/11, sem Supabase)

O servidor já está publicado em **robo-da-black-bot.vercel.app** (projeto Vercel `robo-da-black-bot`), guardando cada conversa num **Vercel Blob privado** (`bot/loja-blob.js`, um JSON por chat). As ofertas vêm do app Ofertas do Telegram publicado. Quem entra direto pelo Telegram já é ligado no `/start` (sem passar pelo app).

Falta só o token, que **você** cola. Rode uma vez no Terminal do Mac:

```bash
bash ~/"dev/03 Dev/robo-da-black-coletor/bot/ligar.sh"
```

Ele confere que o token é do @JackbotDaBlackBot, grava `TELEGRAM_TOKEN`, `TELEGRAM_SECRET`, `CRON_SECRET`, `APP_URL` e `FOTO_URL` na Vercel, publica, aponta o webhook e guarda o segredo dos alertas em `robo-da-black-telegram/.segredo-bot`.
Alertas: depois de cada coleta o `publicar.sh` do app Ofertas chama `/api/alertas`; também roda 1×/dia pelo cron da Vercel (10h de Brasília).
Quando existir Supabase, basta pôr `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` na Vercel: `bot/escolher-loja.js` passa a usar a loja do Supabase.

## 1. Criar o bot (você, no Telegram)

1. Abra **@BotFather** → `/newbot`
2. Nome: `Jackbot · Robô da Black`
3. Usuário: precisa terminar em `bot` (ex.: `JackbotDaBlackBot`)
4. O BotFather devolve o **token**. Guarde. **Não cole no chat nem no código**: só em variável de ambiente.
5. `/setuserpic` → envie `bot/assets/jackbot-perfil.png`

## 2. Testar agora, neste Mac (sem banco, sem servidor)

```bash
cd ~/"dev/03 Dev/robo-da-black-coletor"
TELEGRAM_TOKEN=cole_aqui node bot/rodar-local.js
```

No celular, abra `https://t.me/SEU_BOT?start=teste123`. Os dados ficam em memória e somem ao fechar (Ctrl+C).
Para ver no terminal sem Telegram: `node bot/simular.js` (demo) ou `node bot/simular.js --conversar`.

## 3. Produção

1. **Supabase**: aplicar `sql/001_esquema.sql`, `002_vigiados.sql`, `003_bot.sql` e expor o schema `robo` na API (Settings → API → Exposed schemas).
2. **Vercel** (projeto do bot, raiz desta pasta) com as variáveis:
   - `TELEGRAM_TOKEN` — do BotFather
   - `TELEGRAM_SECRET` — texto aleatório longo (o Telegram manda no cabeçalho, o webhook confere)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_URL` — link do app (ex.: https://robo-da-black-app.vercel.app)
   - `FOTO_URL` — `https://<projeto-do-bot>.vercel.app/jackbot-ola.png`
3. Configurar uma vez:
   ```bash
   TELEGRAM_TOKEN=... TELEGRAM_SECRET=... WEBHOOK_URL=https://<projeto-do-bot>.vercel.app/api/telegram node bot/configurar.js
   ```
4. No app (`robo-da-black/app.js`): `BOT_TELEGRAM = 'SEU_BOT'` — o botão "Abrir no Telegram" vira `t.me/SEU_BOT?start=<id>`.
5. GitHub Actions: depois do coletor, `node bot/enviar-alertas.js` (com as mesmas variáveis como secrets).

## Arquivos

- `bot/conversa.js` — o cérebro: recebe a mensagem, devolve o que enviar
- `bot/textos.js` — toda a fala e os botões do Jackbot
- `bot/loja-memoria.js` / `bot/loja-supabase.js` — onde guarda (teste / produção)
- `bot/telegram.js` — cliente da API do Telegram
- `api/telegram.js` — webhook na Vercel
- `bot/enviar-alertas.js`, `bot/configurar.js`, `bot/rodar-local.js`, `bot/simular.js`
- `test/bot.test.js` — `npm test`
