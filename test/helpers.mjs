import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

export function fixture(name) {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

export function mockFetch(t, responses) {
  const pending = [...responses];
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url: String(url), options });
    assert.ok(pending.length, `Unexpected HTTP request: ${url}`);
    const response = pending.shift();
    if (response instanceof Error) throw response;
    return response instanceof Response ? response : new Response(response);
  });
  t.after(() => assert.equal(pending.length, 0, "Expected HTTP requests were not made"));
  return calls;
}
