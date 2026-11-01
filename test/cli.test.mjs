import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCli } from "../src/cli.mjs";
import { renderHarnessConfig } from "../src/harness.mjs";

function output() {
  let text = "";
  return {
    stream: {
      write: (value) => {
        text += value;
      },
    },
    text: () => text,
  };
}

for (const args of [
  [],
  ["--help"],
  ["-h"],
  ["help"],
  ["--version"],
  ["-v"],
  ["login", "--url"],
  ["config", "opencode"],
  ["config", "opencode", "--v2"],
  ["config", "claude"],
  ["config", "codex"],
]) {
  test(`mercy command produces useful output: ${args.join(" ") || "default"}`, async () => {
    const sink = output();
    const result = await runCli(args, { output: sink.stream });
    assert.equal(result, 0);
    assert.ok(sink.text().length > 0);
    if (args[0] === "login") assert.equal(sink.text(), "https://portal.mercubuana.ac.id/\n");
  });
}

test("mercy serve delegates to the stdio server without writing CLI output", async () => {
  const sink = output();
  let started = false;
  assert.equal(
    await runCli(["serve"], {
      output: sink.stream,
      serve: async () => {
        started = true;
      },
    }),
    0,
  );
  assert.equal(started, true);
  assert.equal(sink.text(), "");
});

test("mercy login signals whether a session was actually saved", async () => {
  assert.equal(await runCli(["login"], { login: async () => ({ saved: true }) }), 0);
  assert.equal(await runCli(["login"], { login: async () => ({ saved: false }) }), 1);
});

test("mercy status returns local state and reports corrupt state as an error", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mercy-status-"));
  const previous = process.env.MERCUBUANA_PORTAL_STATE;
  const stateFile = path.join(dir, "portal-state.json");
  process.env.MERCUBUANA_PORTAL_STATE = stateFile;
  t.after(() => {
    if (previous === undefined) delete process.env.MERCUBUANA_PORTAL_STATE;
    else process.env.MERCUBUANA_PORTAL_STATE = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const missing = output();
  assert.equal(await runCli(["status"], { output: missing.stream }), 0);
  assert.equal(JSON.parse(missing.text()).hasSession, false);
  fs.writeFileSync(stateFile, "invalid JSON");
  const corrupt = output();
  assert.equal(await runCli(["status"], { output: corrupt.stream }), 1);
  assert.match(JSON.parse(corrupt.text()).error, /formatnya tidak valid/);
});

for (const args of [
  ["unknown"],
  ["login", "--bad"],
  ["serve", "--bad"],
  ["status", "--bad"],
  ["config"],
  ["config", "claude", "--v2"],
  ["config", "opencode", "--bad"],
  ["config", "invalid"],
]) {
  test(`mercy rejects unknown commands and options: ${args.join(" ")}`, async () => {
    await assert.rejects(runCli(args));
  });
}

test("harness configs preserve Windows paths with spaces using direct Node invocation", () => {
  const nodePath = "C:\\Program Files\\nodejs\\node.exe";
  const cliPath = "C:\\Users\\Example User\\mercy\\bin\\mercy.mjs";
  const options = { nodePath, cliPath };
  const claude = JSON.parse(renderHarnessConfig("claude", options));
  assert.equal(claude.mcpServers.mercy.command, nodePath);
  assert.deepEqual(claude.mcpServers.mercy.args, [cliPath, "serve"]);
  const codex = renderHarnessConfig("codex", options);
  assert.equal(JSON.parse(codex.match(/^command = (.*)$/m)[1]), nodePath);
  assert.deepEqual(JSON.parse(codex.match(/^args = (.*)$/m)[1]), [cliPath, "serve"]);
  const v1 = JSON.parse(renderHarnessConfig("opencode", options));
  assert.deepEqual(v1.mcp.mercy.command, [nodePath, cliPath, "serve"]);
  assert.equal(v1.mcp.mercy.enabled, true);
  const v2 = JSON.parse(renderHarnessConfig("opencode", { ...options, opencodeV2: true }));
  assert.deepEqual(v2.mcp.servers.mercy.command, [nodePath, cliPath, "serve"]);
  assert.equal(v2.mcp.servers.mercy.enabled, undefined);
  assert.equal(v2.mcp.servers.mercy.timeout.execution, 90000);
});
