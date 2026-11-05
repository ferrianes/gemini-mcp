# Gemini MCP (`gemini-mcp`)

A local [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that automates `gemini.google.com` using an authenticated browser profile via Playwright CDP.

Built specifically to unlock web-exclusive capabilities—including **4 Argon**, **3.1 Pro**, and **Thinking Level** depth controls—directly inside agentic workflows (Claude Desktop, Cursor, Hermes Agent, etc.).

---

## Features

- **Model Switching**:
  - `4 Argon` (*Complex tasks / Deep reasoning*) — **Requires Gemini Advanced / Google One AI Premium (Pro) plan**
  - `3.1 Pro` (*Advanced reasoning*)
  - `3.8 Flash` (*All-around everyday tasks*)
  - `3.5 Flash-Lite` (*Fastest responses*)

> [!NOTE]
> **Google Plan Requirement for 4 Argon**:
> To unlock and use **4 Argon**, your signed-in Google account must have an active **Google One AI Premium / Gemini Advanced (Pro)** subscription. Free-tier Google accounts will only have access to `3.8 Flash` and `3.5 Flash-Lite`.
- **Thinking Depth**:
  - `Low` (Quick & concise)
  - `Medium` (Balanced depth)
  - `High` (Extra thorough reasoning)
- **Local File Uploads**: Upload images, documents, and code files directly via `gemini_upload_and_ask`.
- **Browser Profile Isolation**: Defaults to a dedicated secondary profile (`Profile 1`) to ensure your main personal profile remains untouched.
- **Headless & Headed Support**: Automatically detects running CDP instances (default: `9333`), launches headless via `xvfb-run` on Linux servers, or opens normally on desktop environments (Linux, macOS, Windows).

---

## Exposed Tools

| Tool | Description |
| :--- | :--- |
| `gemini_status` | Returns connection state, signed-in Google account, active model, and thinking level. |
| `gemini_chat` | Sends a prompt to Gemini with optional model selection, thinking level, and chat reset. Waits for streaming to complete. |
| `gemini_switch_model` | Changes the active model or adjusts thinking level without sending a message. |
| `gemini_new_chat` | Resets the session and opens a fresh conversation. |
| `gemini_upload_and_ask` | Uploads local file paths (images/docs/code) and submits a prompt about them. |

---

## Prerequisites

1. **Google Account with Pro Plan**: To access **4 Argon**, your account must be subscribed to **Gemini Advanced / Google One AI Premium (Pro)**.
2. **Node.js**: v18.0.0 or higher.
3. **Browser**: [Brave Browser](https://brave.com/) (recommended) or Google Chrome.
4. **(Optional - Linux Headless)**: If running on a headless Linux server without a display:
   ```bash
   sudo apt update && sudo apt install -y xvfb
   ```

---

## Quick Start

### 1. Clone & Build

```bash
git clone https://github.com/ferrianes/gemini-mcp.git
cd gemini-mcp
npm install
npm run build
```

### 2. One-Time Google Authentication

Before running the MCP server, sign in to your Google Account on the designated browser profile once:

#### On Linux:
```bash
brave-browser --profile-directory="Profile 1" "https://gemini.google.com/app?hl=en"
```

#### On macOS:
```bash
open -a "Brave Browser" --args --profile-directory="Profile 1" "https://gemini.google.com/app?hl=en"
```

1. Log in to your Google account (with Gemini Advanced / Google One Pro access).
2. Complete 2FA / Passkey verification.
3. Once the Gemini chat interface loads, close the browser window. The session cookies will be saved in that profile.

---

## MCP Configuration

Add `gemini-mcp` to your MCP client configuration:

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "gemini": {
      "command": "/path/to/gemini-mcp/run.sh"
    }
  }
}
```

Or execute directly via Node:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "node",
      "args": ["/path/to/gemini-mcp/dist/index.js"]
    }
  }
}
```

---

## Environment Variables

You can customize behavior using the following environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `GEMINI_MCP_BROWSER` | Auto-detected | Path to browser binary (e.g. `/usr/bin/brave-browser`). |
| `GEMINI_MCP_PROFILE` | `Profile 1` | Chrome/Brave profile folder name to use. |
| `GEMINI_MCP_USER_DATA_DIR` | OS Default | Path to the browser user data directory. |
| `GEMINI_MCP_CDP_PORT` | `9333` | Port used for Chrome DevTools Protocol remote debugging. |

---

## License

This project is licensed under the [MIT License](LICENSE).
