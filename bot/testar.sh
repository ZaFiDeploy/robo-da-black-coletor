#!/bin/bash
# Liga o Jackbot neste Mac para testar no celular. Pede o token escondido (não aparece na tela nem fica salvo).
#   bash bot/testar.sh
cd "$(dirname "$0")/.." || exit 1
printf 'Cole o token do BotFather (fica escondido) e aperte Enter: '
read -rs TELEGRAM_TOKEN
echo
[ -z "$TELEGRAM_TOKEN" ] && { echo 'Nenhum token colado.'; exit 1; }
export TELEGRAM_TOKEN
exec node bot/rodar-local.js
