import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { authStatus, savePortalState } from "../src/auth.mjs";
import { getConfig } from "../src/config.mjs";

const cookie = {
  name: "session",
  value: "private-cookie-value",
  domain: ".mercubuana.ac.id",
  expires: -1,
};
function temporaryState(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-mercy-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, "session", "portal-state.json");
}

test("auth reports absent local sessions without claiming verified login", (t) => {
  const result = authStatus({ stateFile: temporaryState(t) });
  assert.equal(result.hasSession, false);
  assert.equal(result.loggedIn, false);
  assert.equal(result.verified, false);
});

test("auth ignores expired, unrelated and malformed cookies and never returns values", (t) => {
  const stateFile = temporaryState(t);
  savePortalState(
    {
      cookies: [
        cookie,
        { ...cookie, expires: 1 },
        { ...cookie, domain: "evilmercubuana.ac.id" },
        { ...cookie, domain: "example.org" },
        null,
        { domain: ".mercubuana.ac.id" },
      ],
    },
    stateFile,
  );
  const result = authStatus({ stateFile });
  assert.equal(result.hasSession, true);
  assert.equal(result.loggedIn, null);
  assert.equal(result.verified, false);
  assert.equal(result.cookieCount, 1);
  assert.equal(JSON.stringify(result).includes(cookie.value), false);
});

test("auth evaluates expiration with a controlled clock", (t) => {
  const stateFile = temporaryState(t);
  savePortalState({ cookies: [cookie] }, stateFile);
  assert.equal(authStatus({ stateFile, now: Date.now() }).cookieCount, 1);
  fs.writeFileSync(stateFile, JSON.stringify({ cookies: [{ ...cookie, expires: 100 }] }));
  assert.equal(authStatus({ stateFile, now: 99000 }).hasSession, true);
  assert.equal(authStatus({ stateFile, now: 100000 }).hasSession, false);
});

test("auth hides raw JSON parse errors and private file content", (t) => {
  const stateFile = temporaryState(t);
  fs.mkdirSync(path.dirname(stateFile));
  fs.writeFileSync(stateFile, '{"cookies": private-cookie-value');
  const result = authStatus({ stateFile });
  assert.equal(result.hasSession, false);
  assert.match(result.error, /formatnya tidak valid/);
  assert.equal(JSON.stringify(result).includes(cookie.value), false);
  fs.writeFileSync(stateFile, "null");
  assert.equal(authStatus({ stateFile }).hasSession, false);
});

test("saving sessions is atomic, creates private files and replaces insecure permissions", (t) => {
  const stateFile = temporaryState(t);
  savePortalState({ cookies: [cookie], origins: [] }, stateFile);
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(stateFile).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.dirname(stateFile)).mode & 0o777, 0o700);
    fs.chmodSync(stateFile, 0o644);
  }
  savePortalState({ cookies: [cookie], origins: [] }, stateFile);
  if (process.platform !== "win32") assert.equal(fs.statSync(stateFile).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(path.dirname(stateFile)), ["portal-state.json"]);
});

test("invalid login state does not overwrite an existing session", (t) => {
  const stateFile = temporaryState(t);
  savePortalState({ cookies: [cookie] }, stateFile);
  const before = fs.readFileSync(stateFile, "utf8");
  assert.throws(() => savePortalState({ cookies: [] }, stateFile), /Tidak ditemukan cookie/);
  assert.throws(() => savePortalState({ cookies: "wrong" }, stateFile), /Format sesi/);
  assert.equal(fs.readFileSync(stateFile, "utf8"), before);
});

test("configuration defaults and legacy environment names are consistent", () => {
  assert.equal(getConfig({}).stateFile, path.join(os.homedir(), ".mcp-mercy", "portal-state.json"));
  const config = getConfig({
    MERCUBUANA_STATE_DIR: "/tmp/mercy-state",
    MERCUBUANA_PORTAL_STATE: "/tmp/custom-state.json",
    MERCUBUANA_CHROME: "/tmp/chrome",
  });
  assert.equal(config.stateFile, path.resolve("/tmp/custom-state.json"));
  assert.equal(config.chromePath, "/tmp/chrome");
});
