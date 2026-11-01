import assert from "node:assert/strict";
import test from "node:test";
import { browserCandidates, findBrowser, openDefaultBrowser } from "../src/browser.mjs";

test("browser override has priority over all automatic detection", () => {
  assert.deepEqual(
    browserCandidates({ chromePath: "/custom/chrome", playwrightPath: "/cached/chrome" }),
    ["/custom/chrome"],
  );
  assert.equal(findBrowser({ chromePath: process.execPath }), process.execPath);
  assert.equal(findBrowser({ chromePath: "/missing-mercy-browser-path" }), undefined);
});

test("browser detection includes macOS system and user applications", () => {
  const candidates = browserCandidates({ platform: "darwin", home: "/Users/example", env: {} });
  assert.ok(candidates.includes("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"));
  assert.ok(
    candidates.includes(
      "/Users/example/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ),
  );
});

test("browser detection includes Windows Chrome and Edge installations", () => {
  const candidates = browserCandidates({
    platform: "win32",
    env: {
      LOCALAPPDATA: "C:\\Users\\Example\\AppData\\Local",
      PROGRAMFILES: "C:\\Program Files",
      "ProgramFiles(x86)": "C:\\Program Files (x86)",
    },
  });
  assert.ok(candidates.includes("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"));
  assert.ok(
    candidates.includes("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"),
  );
  assert.ok(
    candidates.includes(
      "C:\\Users\\Example\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
    ),
  );
  assert.deepEqual(browserCandidates({ platform: "win32", env: {} }), []);
});

test("browser detection includes Linux and cached Playwright browsers", () => {
  const candidates = browserCandidates({ platform: "linux", playwrightPath: "/cached/chrome" });
  assert.equal(candidates[0], "/cached/chrome");
  assert.ok(candidates.includes("/snap/bin/chromium"));
});

for (const [platform, command] of [
  ["linux", "xdg-open"],
  ["darwin", "open"],
  ["win32", "rundll32.exe"],
]) {
  test(`browser opener on ${platform} passes the URL without a shell`, () => {
    const url = "https://portal.mercubuana.ac.id/?a=1&b=2";
    let called = false;
    assert.equal(
      openDefaultBrowser(url, {
        platform,
        run: (cmd, args, options) => {
          called = true;
          assert.equal(cmd, command);
          assert.equal(args.at(-1), url);
          assert.equal(options.shell, false);
          assert.equal(options.timeout, 5000);
          return { status: 0 };
        },
      }),
      true,
    );
    assert.equal(called, true);
  });
}

test("browser opener reports missing executables and failed exit codes", () => {
  assert.equal(
    openDefaultBrowser("https://example.org", {
      run: () => ({ error: new Error("ENOENT"), status: null }),
    }),
    false,
  );
  assert.equal(openDefaultBrowser("https://example.org", { run: () => ({ status: 1 }) }), false);
});
