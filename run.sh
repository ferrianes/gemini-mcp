#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

CDP_PORT="${GEMINI_MCP_CDP_PORT:-9333}"

# Check if CDP port is responding
if ! curl -s --max-time 1 "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null 2>&1; then
    xvfb-run -a -s "-screen 0 1920x1080x24" /usr/bin/brave-browser \
        --remote-debugging-port="${CDP_PORT}" \
        --user-data-dir="/home/ferrianes/.config/BraveSoftware/Brave-Browser" \
        --profile-directory="Profile 1" \
        --no-first-run \
        --no-default-browser-check \
        "https://gemini.google.com/app?hl=en" >/dev/null 2>&1 &

    for i in {1..30}; do
        if curl -s --max-time 1 "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null 2>&1; then
            break
        fi
        sleep 0.5
    done
fi

cd "$DIR"
export GEMINI_MCP_BROWSER="/usr/bin/brave-browser"
export GEMINI_MCP_CDP_PORT="${CDP_PORT}"
exec node dist/index.js
