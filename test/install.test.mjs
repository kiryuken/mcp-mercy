import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/install.sh", import.meta.url));
function sandbox(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mercy-installer-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const argsFile = path.join(directory, "npm-args.json");
  const helper = path.join(directory, "capture.mjs");
  fs.writeFileSync(
    helper,
    'import fs from "node:fs";fs.writeFileSync(process.env.MERCY_TEST_ARGS,JSON.stringify(process.argv.slice(2)));process.exit(Number(process.env.MERCY_TEST_NPM_EXIT || 0));',
  );
  if (process.platform === "win32") {
    fs.writeFileSync(path.join(directory, "npm.cmd"), `@"${process.execPath}" "${helper}" %*\r\n`);
  } else {
    fs.writeFileSync(
      path.join(directory, "npm"),
      '#!/bin/sh\nexec "$MERCY_TEST_NODE" "$MERCY_TEST_HELPER" "$@"\n',
      { mode: 0o755 },
    );
  }
  return {
    directory,
    argsFile,
    env: {
      ...process.env,
      PATH: `${directory}${path.delimiter}${process.env.PATH}`,
      MERCY_TEST_NODE: process.execPath,
      MERCY_TEST_HELPER: helper,
      MERCY_TEST_ARGS: argsFile,
    },
  };
}

test(
  "POSIX installer preserves package and prefix paths with spaces without requiring sudo",
  { skip: process.platform === "win32" },
  (t) => {
    const setup = sandbox(t);
    const prefix = path.join(setup.directory, "prefix with spaces");
    const spec = path.join(setup.directory, "local package.tgz");
    const result = spawnSync("sh", [script, "--prefix", prefix, "--package", spec], {
      env: setup.env,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(setup.argsFile, "utf8")), [
      "install",
      "--global",
      "--prefix",
      prefix,
      spec,
    ]);
    assert.match(result.stdout, /PATH/);
    assert.match(result.stdout, /mercy login/);
  },
);

test(
  "POSIX installer supports the default GitHub source and reports npm failure",
  { skip: process.platform === "win32" },
  (t) => {
    const setup = sandbox(t);
    const result = spawnSync("sh", [script, "--prefix", setup.directory], {
      env: { ...setup.env, MERCY_TEST_NPM_EXIT: "17" },
      encoding: "utf8",
    });
    assert.equal(result.status, 17);
    assert.equal(
      JSON.parse(fs.readFileSync(setup.argsFile, "utf8")).at(-1),
      "https://github.com/kiryuken/mcp-mercy/archive/refs/heads/main.tar.gz",
    );
    assert.doesNotMatch(result.stdout, /terpasang/);
  },
);

for (const args of [
  ["--unknown"],
  ["--package"],
  ["--package", "-malicious-option"],
  ["--prefix", "relative/path"],
]) {
  test(
    `POSIX installer rejects invalid arguments: ${args.join(" ")}`,
    { skip: process.platform === "win32" },
    (t) => {
      const setup = sandbox(t);
      const result = spawnSync("sh", [script, ...args], { env: setup.env, encoding: "utf8" });
      assert.notEqual(result.status, 0);
      assert.equal(fs.existsSync(setup.argsFile), false);
    },
  );
}

test(
  "Windows installer passes literal package and prefix paths to npm.cmd",
  { skip: process.platform !== "win32" },
  (t) => {
    const setup = sandbox(t);
    const prefix = path.join(setup.directory, "prefix with spaces");
    const spec = path.join(setup.directory, "local package.tgz");
    const result = spawnSync(
      "pwsh",
      [
        "-NoProfile",
        "-File",
        fileURLToPath(new URL("../scripts/install.ps1", import.meta.url)),
        "-Prefix",
        prefix,
        "-Package",
        spec,
      ],
      { env: setup.env, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(setup.argsFile, "utf8")), [
      "install",
      "--global",
      "--prefix",
      prefix,
      spec,
    ]);
    assert.match(result.stdout, /PATH/);
  },
);
