#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GeminiDriver } from "./gemini.js";

const driver = new GeminiDriver();
const server = new McpServer({ name: "gemini-mcp", version: "0.1.0" });

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const reply = async (work: Promise<unknown>): Promise<ToolResult> => {
  try {
    const data = await work;
    return {
      content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2) }],
      isError: true,
    };
  }
};

server.registerTool(
  "gemini_status",
  {
    title: "Gemini Web Status",
    description: "Check the Gemini web session (signed-in Google account, active model, thinking level, and available models).",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  () => reply(driver.getStatus()),
);

server.registerTool(
  "gemini_chat",
  {
    title: "Chat with Gemini",
    description:
      "Send a prompt to Gemini web. Supports switching models ('Argon' / '4 Argon', 'Pro' / '3.1 Pro', 'Flash' / '3.8 Flash', 'Flash-Lite') and setting thinking level ('low', 'medium', 'high'). Waits for response to complete and returns the text.",
    inputSchema: z.object({
      prompt: z.string().describe("The user prompt or instruction to send to Gemini."),
      model: z
        .enum(["Argon", "Pro", "Flash", "Flash-Lite", "4 Argon", "3.1 Pro", "3.8 Flash", "3.5 Flash-Lite"])
        .optional()
        .describe("Target model to select. Defaults to current active model."),
      thinking_level: z
        .enum(["low", "medium", "high", "Low", "Medium", "High"])
        .optional()
        .describe("Thinking depth level for reasoning models."),
      new_chat: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to reset to a clean chat window before sending."),
      timeout_seconds: z
        .number()
        .optional()
        .default(180)
        .describe("Max seconds to wait for generation to finish."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  (args) => reply(driver.chat(args)),
);

server.registerTool(
  "gemini_switch_model",
  {
    title: "Switch Model or Thinking Level",
    description: "Switch the active model ('Argon', 'Pro', 'Flash', 'Flash-Lite') or adjust thinking level without sending a chat message.",
    inputSchema: z.object({
      model: z
        .enum(["Argon", "Pro", "Flash", "Flash-Lite", "4 Argon", "3.1 Pro", "3.8 Flash", "3.5 Flash-Lite"])
        .optional()
        .describe("Model to switch to."),
      thinking_level: z
        .enum(["low", "medium", "high", "Low", "Medium", "High"])
        .optional()
        .describe("Thinking level to set."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  (args) => reply(driver.switchModel(args.model, args.thinking_level)),
);

server.registerTool(
  "gemini_new_chat",
  {
    title: "Start New Chat",
    description: "Start a fresh chat conversation on Gemini.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  () => reply(driver.newChat().then(() => ({ success: true, message: "Started new conversation." }))),
);

server.registerTool(
  "gemini_upload_and_ask",
  {
    title: "Upload Files and Ask Gemini",
    description: "Upload one or more local files (images, documents, code) to Gemini and ask a question about them.",
    inputSchema: z.object({
      file_paths: z.array(z.string()).describe("Absolute paths to the local files to upload."),
      prompt: z.string().describe("Prompt or instructions regarding the uploaded file(s)."),
      model: z
        .enum(["Argon", "Pro", "Flash", "Flash-Lite", "4 Argon", "3.1 Pro", "3.8 Flash", "3.5 Flash-Lite"])
        .optional()
        .describe("Target model."),
      thinking_level: z
        .enum(["low", "medium", "high", "Low", "Medium", "High"])
        .optional()
        .describe("Thinking depth level."),
      new_chat: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to reset to a clean chat window before sending."),
      timeout_seconds: z
        .number()
        .optional()
        .default(180)
        .describe("Max seconds to wait for generation to finish."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  (args) => reply(driver.uploadAndChat(args)),
);

await server.connect(new StdioServerTransport());
