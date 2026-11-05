#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source NVM if present and node not in PATH
if ! command -v node >/dev/null 2>&1; then
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
fi

CDP_PORT="${GEMINI_MCP_CDP_PORT:-9333}"

# Detect default browser executable if not explicitly provided
if [ -z "$GEMINI_MCP_BROWSER" ]; then
    for candidate in \
        "/usr/bin/brave-browser" \
        "/opt/brave.com/brave/brave" \
        "/usr/bin/google-chrome" \
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
        if [ -x "$candidate" ] || [ -f "$candidate" ]; then
            GEMINI_MCP_BROWSER="$candidate"
            break
        fi
    done
fi

# Detect default user data directory based on OS
if [ -z "$GEMINI_MCP_USER_DATA_DIR" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        GEMINI_MCP_USER_DATA_DIR="$HOME/Library/Application Support/BraveSoftware/Brave-Browser"
    else
        GEMINI_MCP_USER_DATA_DIR="$HOME/.config/BraveSoftware/Brave-Browser"
    fi
fi

PROFILE_DIR="${GEMINI_MCP_PROFILE:-Profile 1}"

# Launch browser if CDP port is not already reachable
if ! curl -s --max-time 1 "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null 2>&1; then
    if [ -n "$GEMINI_MCP_BROWSER" ]; then
        ARGS=(
            "--remote-debugging-port=${CDP_PORT}"
            "--user-data-dir=${GEMINI_MCP_USER_DATA_DIR}"
            "--profile-directory=${PROFILE_DIR}"
            "--no-first-run"
            "--no-default-browser-check"
            "https://gemini.google.com/app?hl=en"
        )

        if [[ "$OSTYPE" == "linux"* ]] && [ -z "$DISPLAY" ] && command -v xvfb-run >/dev/null 2>&1; then
            xvfb-run -a -s "-screen 0 1920x1080x24" "$GEMINI_MCP_BROWSER" "${ARGS[@]}" >/dev/null 2>&1 &
        else
            "$GEMINI_MCP_BROWSER" "${ARGS[@]}" >/dev/null 2>&1 &
        fi

        for i in {1..30}; do
            if curl -s --max-time 1 "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null 2>&1; then
                break
            fi
            sleep 0.5
        done
    fi
fi

cd "$DIR"
[ -n "$GEMINI_MCP_BROWSER" ] && export GEMINI_MCP_BROWSER
export GEMINI_MCP_CDP_PORT="${CDP_PORT}"
export GEMINI_MCP_USER_DATA_DIR
export GEMINI_MCP_PROFILE="${PROFILE_DIR}"

exec node dist/index.js
