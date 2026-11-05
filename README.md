# Gemini MCP (gemini-mcp)

Local Model Context Protocol (MCP) server that drives `gemini.google.com` using authenticated Brave browser profile automation via Playwright CDP.

Built specifically for Google Pro subscribers to unlock web-exclusive capabilities including **4 Argon**, **3.1 Pro**, and **Thinking Level** controls directly from agentic workflows.

## Features

- **Model Selection**: Switch seamlessly between:
  - `4 Argon` (*Complex tasks / Deep reasoning*)
  - `3.1 Pro` (*Advanced reasoning*)
  - `3.8 Flash` (*All-around help*)
  - `3.5 Flash-Lite` (*Fastest answers*)
- **Thinking Depth**: Configure reasoning intensity:
  - `Low` (Quick and efficient)
  - `Medium` (Balanced depth)
  - `High` (Extra thorough)
- **File Uploads**: Pass local file paths (images, text, docs) to `gemini_upload_and_ask`.
- **Browser Isolation**: Uses dedicated automation profile (`Profile 1` on disk) and strictly never touches personal/default profiles.
- **Auto Launch**: Automatically hooks into existing CDP sessions (port `9333`) or launches via `xvfb-run` headlessly.

## Exposed Tools

1. `gemini_status`: Check connection state, signed-in Google account, active model, and thinking level.
2. `gemini_chat`: Send a prompt with custom model, thinking level, and optional new chat reset.
3. `gemini_switch_model`: Switch active model or thinking level without sending a prompt.
4. `gemini_new_chat`: Reset and open a clean conversation window.
5. `gemini_upload_and_ask`: Upload local files and ask Gemini a prompt about them.

## Setup & Running

```bash
# Build
npm install
npm run build

# Start MCP Server (stdio)
./run.sh
```

## MCP Configuration Example

Add to your `hermes` config or Claude Desktop config:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "/home/ferrianes/Code/gemini-mcp/run.sh"
    }
  }
}
```
