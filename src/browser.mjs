import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function browserCandidates({
  platform = process.platform,
  env = process.env,
  home = os.homedir(),
  playwrightPath,
  chromePath,
} = {}) {
  if (chromePath) return [chromePath];
  const candidates = [playwrightPath];
  if (platform === "win32") {
    for (const dir of [
      env.LOCALAPPDATA,
      env.PROGRAMFILES,
      env["PROGRAMFILES(X86)"],
      env.ProgramFiles,
      env["ProgramFiles(x86)"],
    ].filter(Boolean)) {
      candidates.push(path.win32.join(dir, "Google", "Chrome", "Application", "chrome.exe"));
      candidates.push(path.win32.join(dir, "Microsoft", "Edge", "Application", "msedge.exe"));
    }
  } else if (platform === "darwin") {
    for (const dir of ["/Applications", path.join(home, "Applications")]) {
      candidates.push(path.join(dir, "Google Chrome.app", "Contents", "MacOS", "Google Chrome"));
      candidates.push(path.join(dir, "Microsoft Edge.app", "Contents", "MacOS", "Microsoft Edge"));
      candidates.push(path.join(dir, "Chromium.app", "Contents", "MacOS", "Chromium"));
    }
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    );
  }
  return [...new Set(candidates.filter(Boolean))];
}

export function findBrowser(options) {
  return browserCandidates(options).find((candidate) => fs.existsSync(candidate));
}

export function openDefaultBrowser(url, { platform = process.platform, run = spawnSync } = {}) {
  const [command, args] =
    platform === "win32"
      ? ["rundll32.exe", ["url.dll,FileProtocolHandler", url]]
      : platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  const result = run(command, args, {
    stdio: "ignore",
    timeout: 5000,
    windowsHide: true,
    shell: false,
  });
  return !result.error && result.status === 0;
}
