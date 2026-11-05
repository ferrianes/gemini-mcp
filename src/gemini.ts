import type { Page } from "playwright-core";
import { getGeminiPage, GEMINI_URL } from "./chrome.js";

export interface GeminiStatus {
  connected: boolean;
  account: string;
  active_model: string;
  thinking_level?: string;
  models_available: string[];
}

export interface ChatOptions {
  prompt: string;
  model?: "Argon" | "Pro" | "Flash" | "Flash-Lite" | string;
  thinking_level?: "low" | "medium" | "high" | string;
  new_chat?: boolean;
  timeout_seconds?: number;
}

export interface ChatResult {
  prompt: string;
  response: string;
  model: string;
  thinking_level?: string;
  duration_seconds: number;
}

export interface UploadOptions {
  file_paths: string[];
  prompt: string;
  model?: string;
  thinking_level?: string;
  new_chat?: boolean;
  timeout_seconds?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GeminiDriver {
  private async getPage(): Promise<Page> {
    return await getGeminiPage();
  }

  async getStatus(): Promise<GeminiStatus> {
    const page = await this.getPage();

    // Account info
    const account = await page.evaluate(() => {
      const el = document.querySelector('a[aria-label*="Google Account"]');
      return el ? (el.getAttribute("aria-label") || "").trim() : "Unknown Account";
    });

    // Active model text
    const activeModel = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label*="Open mode picker"]') as HTMLElement | null;
      return btn ? (btn.innerText || "").trim() : "Unknown";
    });

    // Read available models from mode picker
    const pickerInfo = await this.probePicker(page);

    return {
      connected: true,
      account,
      active_model: activeModel,
      thinking_level: pickerInfo.activeThinkingLevel,
      models_available: pickerInfo.models,
    };
  }

  private async probePicker(page: Page): Promise<{ models: string[]; activeThinkingLevel?: string }> {
    try {
      const pickerBtn = await page.$('button[aria-label*="Open mode picker"]');
      if (!pickerBtn) return { models: [] };

      await pickerBtn.click();
      await sleep(600);

      const data = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll("gem-menu-item")) as HTMLElement[];
        const models: string[] = [];
        let activeThinkingLevel: string | undefined;

        for (const it of items) {
          const txt = (it.innerText || "").trim().replace(/\n+/g, " - ");
          if (/flash|pro|argon/i.test(txt)) {
            models.push(txt);
          }
          if (it.className.includes("selected") && /low|medium|high/i.test(txt)) {
            activeThinkingLevel = txt.split(" - ")[0];
          }
        }
        return { models, activeThinkingLevel };
      });

      await page.keyboard.press("Escape");
      await sleep(300);
      return data;
    } catch {
      return { models: [] };
    }
  }

  async switchModel(model?: string, thinkingLevel?: string): Promise<{ active_model: string; thinking_level?: string }> {
    const page = await this.getPage();

    if (model) {
      const normalized = model.toLowerCase();
      let targetLabel = "4 Argon";
      if (normalized.includes("lite") || normalized.includes("3.5")) {
        targetLabel = "3.5 Flash-Lite";
      } else if (normalized.includes("flash") || normalized.includes("3.8")) {
        targetLabel = "3.8 Flash";
      } else if (normalized.includes("pro") || normalized.includes("3.1")) {
        targetLabel = "3.1 Pro";
      } else if (normalized.includes("argon") || normalized.includes("4")) {
        targetLabel = "4 Argon";
      }

      const pickerBtn = await page.$('button[aria-label*="Open mode picker"]');
      if (pickerBtn) {
        await pickerBtn.click();
        await sleep(600);

        const modelItem = await page.$(`gem-menu-item:has-text("${targetLabel}")`);
        if (modelItem) {
          await modelItem.click();
          await sleep(800);
        } else {
          await page.keyboard.press("Escape");
        }
      }
    }

    if (thinkingLevel) {
      const normalizedLevel = thinkingLevel.toLowerCase();
      let targetLevel = "Medium";
      if (normalizedLevel.includes("low")) targetLevel = "Low";
      else if (normalizedLevel.includes("high")) targetLevel = "High";
      else if (normalizedLevel.includes("medium")) targetLevel = "Medium";

      const pickerBtn = await page.$('button[aria-label*="Open mode picker"]');
      if (pickerBtn) {
        await pickerBtn.click();
        await sleep(600);

        const thinkingMenu = await page.$('gem-menu-item:has-text("Thinking level")');
        if (thinkingMenu) {
          await thinkingMenu.hover();
          await sleep(500);

          const levelItem = await page.$(`gem-menu-item:has-text("${targetLevel}")`);
          if (levelItem) {
            await levelItem.click();
            await sleep(500);
          }
        }
        await page.keyboard.press("Escape");
        await sleep(300);
      }
    }

    const activeModel = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label*="Open mode picker"]') as HTMLElement | null;
      return btn ? (btn.innerText || "").trim() : "Unknown";
    });

    return { active_model: activeModel, thinking_level: thinkingLevel };
  }

  async newChat(): Promise<void> {
    const page = await this.getPage();
    await page.goto(GEMINI_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(".ql-editor", { timeout: 15000 });
    await sleep(1000);
  }

  async chat(opts: ChatOptions): Promise<ChatResult> {
    const page = await this.getPage();

    if (opts.new_chat) {
      await this.newChat();
    }

    if (opts.model || opts.thinking_level) {
      await this.switchModel(opts.model, opts.thinking_level);
    }

    const editor = await page.waitForSelector(".ql-editor", { timeout: 15000 });
    if (!editor) throw new Error("Could not find Gemini message editor (.ql-editor)");

    // Type prompt
    await editor.click();
    await editor.fill(opts.prompt);
    await sleep(500);

    // Wait for send button
    const sendBtn = await page.waitForSelector('button[aria-label="Send message"]', { timeout: 10000 });
    if (!sendBtn) throw new Error("Send button not available");

    const startTime = Date.now();
    await sendBtn.click();

    // Wait for response to finish streaming
    const timeoutMs = (opts.timeout_seconds ?? 180) * 1000;
    const deadline = Date.now() + timeoutMs;
    let lastText = "";
    let stableCount = 0;

    await sleep(1500); // Give it a moment to register and start thinking/streaming

    while (Date.now() < deadline) {
      await sleep(1000);

      const state = await page.evaluate(() => {
        const stopBtn = document.querySelector('button[aria-label*="Stop"]');
        const responses = Array.from(document.querySelectorAll("model-response"));
        const lastResponse = responses[responses.length - 1];

        if (!lastResponse) {
          return { isStreaming: !!stopBtn, text: "" };
        }

        const msgContent = lastResponse.querySelector("message-content") as HTMLElement | null;
        const text = msgContent ? (msgContent.innerText || "").trim() : (lastResponse as HTMLElement).innerText.trim();

        return {
          isStreaming: !!stopBtn,
          text,
        };
      });

      if (state.text && state.text === lastText && !state.isStreaming) {
        stableCount++;
        if (stableCount >= 2) {
          // Finished and stable
          break;
        }
      } else {
        stableCount = 0;
        lastText = state.text;
      }
    }

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    const activeModel = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label*="Open mode picker"]') as HTMLElement | null;
      return btn ? (btn.innerText || "").trim() : "Unknown";
    });

    return {
      prompt: opts.prompt,
      response: lastText,
      model: activeModel,
      thinking_level: opts.thinking_level,
      duration_seconds: durationSeconds,
    };
  }

  async uploadAndChat(opts: UploadOptions): Promise<ChatResult> {
    const page = await this.getPage();

    if (opts.new_chat) {
      await this.newChat();
    }

    if (opts.model || opts.thinking_level) {
      await this.switchModel(opts.model, opts.thinking_level);
    }

    // Open upload menu
    const uploadBtn = await page.waitForSelector('button[aria-label*="Upload"]', { timeout: 10000 });
    if (!uploadBtn) throw new Error("Upload button not found");
    await uploadBtn.click();
    await sleep(600);

    // Check for "Agree" disclaimer if it pops up
    try {
      const agreeBtn = await page.$('button:has-text("Agree")');
      if (agreeBtn) {
        await agreeBtn.click();
        await sleep(600);
      }
    } catch {
      // Ignore
    }

    const uploadFileItem = await page.waitForSelector('[role="menuitem"]:has-text("Upload files"), button:has-text("Upload files")', {
      timeout: 5000,
    });
    if (!uploadFileItem) throw new Error("Upload files menu item not found");

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 10000 }),
      uploadFileItem.click(),
    ]);

    await fileChooser.setFiles(opts.file_paths);
    await sleep(2500); // Wait for chips to attach

    return await this.chat({
      prompt: opts.prompt,
      timeout_seconds: opts.timeout_seconds,
    });
  }
}
