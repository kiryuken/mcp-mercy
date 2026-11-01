import { chromium } from "playwright-core";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { getConfig } from "./config.mjs";
import { savePortalState } from "./auth.mjs";
import { findBrowser, openDefaultBrowser } from "./browser.mjs";

export function portalUrl(config = getConfig()) {
  let url;
  try {
    url = new URL(config.portalUrl);
  } catch {
    throw new Error("URL Portal tidak valid.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("URL Portal harus menggunakan HTTPS tanpa kredensial pada URL.");
  }
  return url.href;
}

export async function runLogin({
  config = getConfig(),
  browserType = chromium,
  input = stdin,
  output = stdout,
  createTerminal = () => readline.createInterface({ input, output }),
  openBrowser = openDefaultBrowser,
} = {}) {
  const url = portalUrl(config);
  const print = (message) => output.write(`${message}\n`);
  print(`Login Portal Mercu Buana: ${url}`);
  if (!input.isTTY) {
    throw new Error(
      "Login memerlukan terminal interaktif dan browser desktop. Buka tautan di atas untuk login manual; tautan saja tidak menyimpan sesi MCP.",
    );
  }
  let browser;
  let context;
  try {
    const executablePath = findBrowser({
      chromePath: config.chromePath,
      playwrightPath: browserType.executablePath(),
    });
    if (!executablePath)
      throw new Error(
        "Chrome/Chromium/Edge tidak ditemukan. Atur MERCUBUANA_CHROME ke executable browser.",
      );
    browser = await browserType.launch({ executablePath, headless: false });
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "id-ID" });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (error) {
    await browser?.close().catch(() => {});
    print(`Browser sesi MCP tidak dapat dibuka: ${error.message}`);
    let opened = false;
    try {
      opened = await openBrowser(url);
    } catch {
      /* The printed URL remains usable if the OS opener fails. */
    }
    print(
      opened
        ? "Permintaan membuka browser bawaan sudah dikirim."
        : `Buka tautan ini secara manual: ${url}`,
    );
    print(
      "Login melalui tautan/browser bawaan tidak mengekspor cookie ke MCP. Setelah browser didukung tersedia, ulangi mercy login untuk menyimpan sesi.",
    );
    return { saved: false, url };
  }
  let terminal;
  try {
    print("Selesaikan login dan CAPTCHA secara manual pada browser yang terbuka.");
    terminal = createTerminal();
    await terminal.question("Tekan Enter setelah login berhasil: ");
    savePortalState(await context.storageState(), config.stateFile);
    print(
      `Sesi disimpan di ${config.stateFile}. Periksa dengan mercy status. Izin file POSIX: 0600.`,
    );
    return { saved: true, stateFile: config.stateFile, url };
  } finally {
    terminal?.close();
    await browser.close();
  }
}
