import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { portalUrl, runLogin } from "../src/login.mjs";
import { authStatus } from "../src/auth.mjs";

function setup(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mercy-login-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const stateFile = path.join(dir, "session", "portal-state.json");
  let text = "";
  const calls = [];
  const state = {
    cookies: [
      { name: "session", value: "test-session-value", domain: ".mercubuana.ac.id", expires: -1 },
    ],
    origins: [],
  };
  const context = {
    newPage: async () => ({
      goto: async (url) => {
        calls.push(["goto", url]);
        if (options.gotoError) throw options.gotoError;
      },
    }),
    storageState: async () => options.state ?? state,
  };
  const browser = {
    newContext: async () => context,
    close: async () => {
      calls.push(["browser.close"]);
    },
  };
  const dependencies = {
    config: {
      portalUrl: "https://portal.mercubuana.ac.id",
      stateFile,
      chromePath: options.missingBrowser ? path.join(dir, "missing-browser") : process.execPath,
    },
    browserType: {
      executablePath: () => process.execPath,
      launch: async ({ executablePath, headless }) => {
        calls.push(["launch", executablePath, headless]);
        if (options.launchError) throw options.launchError;
        return browser;
      },
    },
    input: { isTTY: true },
    output: {
      write: (value) => {
        text += value;
      },
    },
    createTerminal: () => ({
      question: async () => {
        calls.push(["question"]);
        if (options.questionError) throw options.questionError;
      },
      close: () => {
        calls.push(["terminal.close"]);
      },
    }),
    openBrowser: async (url) => {
      calls.push(["fallback", url]);
      if (options.openError) throw options.openError;
      return options.opened ?? false;
    },
  };
  return { dependencies, stateFile, calls, text: () => text };
}

test("login opens a browser and saves state after manual confirmation", async (t) => {
  const scenario = setup(t);
  const result = await runLogin(scenario.dependencies);
  assert.equal(result.saved, true);
  assert.equal(authStatus({ stateFile: scenario.stateFile }).hasSession, true);
  assert.deepEqual(
    scenario.calls.map(([name]) => name),
    ["launch", "goto", "question", "terminal.close", "browser.close"],
  );
  assert.equal(scenario.calls[0][2], false);
  assert.match(scenario.text(), /https:\/\/portal\.mercubuana\.ac\.id/);
  assert.doesNotMatch(scenario.text(), /test-session-value/);
});

for (const options of [
  { missingBrowser: true },
  { launchError: new Error("No graphical display"), opened: true },
  { gotoError: new Error("Portal unavailable") },
  { launchError: new Error("No display"), openError: new Error("No opener") },
]) {
  test(`login provides a usable fallback link when browser startup fails: ${Object.keys(options).join(", ")}`, async (t) => {
    const scenario = setup(t, options);
    const result = await runLogin(scenario.dependencies);
    assert.equal(result.saved, false);
    assert.equal(fs.existsSync(scenario.stateFile), false);
    assert.match(scenario.text(), /https:\/\/portal\.mercubuana\.ac\.id/);
    assert.match(scenario.text(), /tidak mengekspor cookie/);
    assert.equal(
      scenario.calls.some(([name]) => name === "fallback"),
      true,
    );
    assert.equal(
      scenario.calls.some(([name]) => name === "question"),
      false,
    );
    if (options.gotoError)
      assert.equal(
        scenario.calls.some(([name]) => name === "browser.close"),
        true,
      );
  });
}

test("login always closes the browser and terminal if no active Portal session was captured", async (t) => {
  const scenario = setup(t, { state: { cookies: [] } });
  await assert.rejects(runLogin(scenario.dependencies), /Tidak ditemukan cookie/);
  assert.equal(fs.existsSync(scenario.stateFile), false);
  assert.deepEqual(scenario.calls.slice(-2), [["terminal.close"], ["browser.close"]]);
});

test("login closes resources after an interrupted confirmation", async (t) => {
  const scenario = setup(t, { questionError: new Error("Cancelled") });
  await assert.rejects(runLogin(scenario.dependencies), /Cancelled/);
  assert.deepEqual(scenario.calls.slice(-2), [["terminal.close"], ["browser.close"]]);
});

test("login in a noninteractive environment prints the Portal link without launching anything", async (t) => {
  const scenario = setup(t);
  scenario.dependencies.input.isTTY = false;
  await assert.rejects(runLogin(scenario.dependencies), /terminal interaktif/);
  assert.match(scenario.text(), /https:\/\/portal\.mercubuana\.ac\.id/);
  assert.deepEqual(scenario.calls, []);
});

for (const url of ["not a URL", "http://example.org", "https://user:password@example.org"]) {
  test(`login rejects an invalid or insecure Portal URL: ${url}`, () => {
    assert.throws(() => portalUrl({ portalUrl: url }), /URL Portal/);
  });
}
