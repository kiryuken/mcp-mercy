import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

for (const [entry, args] of [
  ["mcp-mercy.mjs", []],
  ["mercy.mjs", ["serve"]],
])
  test(
    `${entry} works from another directory with clean stdout and stderr`,
    { timeout: 15000 },
    async (t) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mercy-stdio-"));
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [fileURLToPath(new URL(`../bin/${entry}`, import.meta.url)), ...args],
        cwd: dir,
        env: {
          PATH: process.env.PATH,
          MERCUBUANA_PORTAL_STATE: path.join(dir, "missing-state.json"),
        },
        stderr: "pipe",
      });
      const client = new Client({ name: "mercy-stdio-test", version: "1.0.0" });
      let stderr = "";
      transport.stderr?.on("data", (data) => {
        stderr += data;
      });
      t.after(async () => {
        await client.close();
        fs.rmSync(dir, { recursive: true, force: true });
      });
      await client.connect(transport);
      assert.equal(client.getServerVersion().name, "mcp-mercy");
      assert.equal((await client.listTools()).tools.length, 7);
      const result = await client.callTool({
        name: "auth_status",
        arguments: {},
      });
      assert.equal(result.structuredContent.hasSession, false);
      await client.close();
      assert.equal(stderr, "");
    },
  );

test("login CLI fails clearly without an interactive terminal", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../bin/login.mjs", import.meta.url))],
    { encoding: "utf8", timeout: 10000 },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /terminal interaktif/);
  assert.match(result.stdout, /https:\/\/portal\.mercubuana\.ac\.id/);
});
