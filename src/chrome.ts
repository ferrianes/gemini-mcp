import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";

export const GEMINI_URL = "https://gemini.google.com/app?hl=en";
export const GEMINI_HOSTS = /^https:\/\/gemini\.google\.com/;

export const CDP_PORT = Number(process.env.GEMINI_MCP_CDP_PORT ?? process.env.FLOW_MCP_CDP_PORT ?? 9333);
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

const BRAVE_PATHS = [
  process.env.GEMINI_MCP_BROWSER,
  "/usr/bin/brave-browser",
  "/opt/brave.com/brave/brave",
  "/usr/bin/google-chrome",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter((p): p is string => Boolean(p));

let browser: Browser | null = null;

export async function cdpUp(): Promise<boolean> {
  try {
    const res = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export function browserExecutable(): string {
  const p = BRAVE_PATHS.find((path) => existsSync(path));
  if (!p) throw new Error("Browser executable not found. Set GEMINI_MCP_BROWSER.");
  return p;
}

export async function launchBrowser(): Promise<void> {
  const exe = browserExecutable();
  const userDataDir = process.env.GEMINI_MCP_USER_DATA_DIR ?? join(homedir(), ".config/BraveSoftware/Brave-Browser");
  const profileDir = process.env.GEMINI_MCP_PROFILE ?? "Profile 1";

  // Launch under xvfb if display is not set or running on Linux
  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    `--profile-directory=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    GEMINI_URL,
  ];

  let child;
  if (process.platform === "linux" && !process.env.DISPLAY && existsSync("/usr/bin/xvfb-run")) {
    child = spawn(
      "xvfb-run",
      ["-a", "-s", "-screen 0 1920x1080x24", "env", "XDG_CURRENT_DESKTOP=X-Cinnamon", "DESKTOP_SESSION=cinnamon", exe, ...args],
      { detached: true, stdio: "ignore" }
    );
  } else {
    child = spawn(exe, args, { detached: true, stdio: "ignore" });
  }
  child.unref();

  for (let i = 0; i < 40; i++) {
    if (await cdpUp()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Browser started but CDP port ${CDP_PORT} never came up.`);
}

export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  if (!(await cdpUp())) {
    await launchBrowser();
  }
  browser = await chromium.connectOverCDP(CDP_URL);
  return browser;
}

export async function getGeminiPage(): Promise<Page> {
  const b = await getBrowser();
  const context = b.contexts()[0];
  if (!context) throw new Error("No browser context found via CDP.");

  const existing = context.pages().find((p) => GEMINI_HOSTS.test(p.url()));
  let page: Page;

  if (existing) {
    page = existing;
  } else {
    page = await context.newPage();
    await page.goto(GEMINI_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  }

  // Handle onboarding / notice modal ("Got it" button)
  try {
    const gotItBtn = await page.$('button:has-text("Got it")');
    if (gotItBtn) {
      await gotItBtn.click();
      await page.waitForTimeout(500);
    }
  } catch {
    // Ignore if not present
  }

  return page;
}
