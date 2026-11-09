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

echo 'Copie o token no Telegram (BotFather → /mybots → JackbotDaBlackBot → API Token).'
if [ "$1" = "copiado" ]; then
  DIGITADO=""   # bash ligar.sh copiado → nem pergunta, usa direto o que está copiado
else
  printf 'Depois cole aqui e aperte Enter — ou só aperte Enter que eu pego do que você copiou: '
  read -rs DIGITADO; echo
fi
# Se não colou nada, usa a área de transferência. Em qualquer caso, pega só o token (números:letras),
# mesmo que tenha vindo junto o texto inteiro da mensagem do BotFather.
[ -z "$DIGITADO" ] && DIGITADO="$(pbpaste 2>/dev/null)"
TELEGRAM_TOKEN="$(printf '%s' "$DIGITADO" | grep -Eo '[0-9]{6,12}:[A-Za-z0-9_-]{30,}' | head -1)"
unset DIGITADO
[ -z "$TELEGRAM_TOKEN" ] && { echo 'Não achei um token no que foi colado nem no que está copiado. Copie o token no BotFather e rode de novo.'; exit 1; }

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
# e para a coleta diária do GitHub avisar o Jackbot depois de cada rodada
printf '%s' "$TELEGRAM_SECRET" | gh secret set TELEGRAM_SECRET -R ZaFiDeploy/robo-da-black-coletor && echo '  segredo gravado no GitHub (coleta diária)'

echo 'Publicando o servidor do Jackbot…'
vercel deploy --prod --yes $ESCOPO >/dev/null

TELEGRAM_TOKEN="$TELEGRAM_TOKEN" TELEGRAM_SECRET="$TELEGRAM_SECRET" WEBHOOK_URL="$BOT_URL/api/telegram" node bot/configurar.js
unset TELEGRAM_TOKEN TELEGRAM_SECRET
echo
echo 'Pronto. Abra o @JackbotDaBlackBot no Telegram e mande /start.'
