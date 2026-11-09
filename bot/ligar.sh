#!/bin/bash
# Liga o Jackbot de verdade (servidor na Vercel: robo-da-black-bot.vercel.app). Rodar UMA vez no Terminal do Mac:
#   bash ~/"dev/03 Dev/robo-da-black-coletor/bot/ligar.sh"
# Pede o token do BotFather (fica escondido), cria o segredo do webhook, grava tudo nas variáveis
# da Vercel, publica o servidor e aponta o Telegram para ele. O token não fica salvo em arquivo nenhum.
set -e
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")/.."
ESCOPO="--scope zafideploys-projects"
BOT_URL="https://robo-da-black-bot.vercel.app"
SEGREDO_LOCAL="$HOME/dev/03 Dev/robo-da-black-telegram/.segredo-bot"

printf 'Cole o token do @JackbotDaBlackBot (BotFather → /mybots → API Token) e aperte Enter: '
read -rs TELEGRAM_TOKEN; echo
[ -z "$TELEGRAM_TOKEN" ] && { echo 'Nenhum token colado.'; exit 1; }

# Confere o token antes de gravar
NOME=$(curl -s "https://api.telegram.org/bot$TELEGRAM_TOKEN/getMe" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.ok?j.result.username:'')})")
[ "$NOME" != "JackbotDaBlackBot" ] && { echo "Esse token não é do @JackbotDaBlackBot (veio: ${NOME:-inválido}). Nada foi gravado."; exit 1; }
echo "Token confere: @$NOME"

TELEGRAM_SECRET=$(openssl rand -hex 32)
grava() { vercel env rm "$1" production --yes $ESCOPO >/dev/null 2>&1 || true; printf '%s' "$2" | vercel env add "$1" production $ESCOPO >/dev/null; echo "  variável $1 gravada"; }
grava TELEGRAM_TOKEN "$TELEGRAM_TOKEN"
grava TELEGRAM_SECRET "$TELEGRAM_SECRET"
grava CRON_SECRET "$TELEGRAM_SECRET"
grava APP_URL "https://robo-da-black-app.vercel.app"
grava FOTO_URL "$BOT_URL/jackbot-ola.png"

# Segredo dos alertas para o publicar.sh do app Ofertas (só este Mac lê)
umask 077; printf '%s' "$TELEGRAM_SECRET" > "$SEGREDO_LOCAL"

echo 'Publicando o servidor do Jackbot…'
vercel deploy --prod --yes $ESCOPO >/dev/null

TELEGRAM_TOKEN="$TELEGRAM_TOKEN" TELEGRAM_SECRET="$TELEGRAM_SECRET" WEBHOOK_URL="$BOT_URL/api/telegram" node bot/configurar.js
unset TELEGRAM_TOKEN TELEGRAM_SECRET
echo
echo 'Pronto. Abra o @JackbotDaBlackBot no Telegram e mande /start.'
