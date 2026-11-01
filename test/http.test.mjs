import assert from "node:assert/strict";
import test from "node:test";
import { fetchText } from "../src/http.mjs";
import { absoluteUrl } from "../src/html.mjs";
import { mockFetch } from "./helpers.mjs";

const url = "https://repository.mercubuana.ac.id/example";

test("HTTP decodes UTF-8 responses and sets a project user-agent", async (t) => {
  const calls = mockFetch(t, [
    new Response("Judul café & teknologi", {
      headers: { "content-type": "text/html" },
    }),
  ]);
  const result = await fetchText(url);
  assert.equal(result.text, "Judul café & teknologi");
  assert.equal(result.contentType, "text/html");
  assert.match(calls[0].options.headers["user-agent"], /mcp-mercy/);
  assert.equal(calls[0].options.headers.cookie, undefined);
});

for (const status of [401, 403, 404, 429, 500]) {
  test(`HTTP surfaces status ${status} without returning upstream response bodies`, async (t) => {
    mockFetch(t, [new Response("private upstream details", { status })]);
    await assert.rejects(
      fetchText(url),
      (error) => error.message.includes(`HTTP ${status}`) && !error.message.includes("private"),
    );
  });
}

test("HTTP converts network failures to actionable errors", async (t) => {
  mockFetch(t, [new TypeError("fetch failed")]);
  await assert.rejects(fetchText(url), /Periksa jaringan atau DNS/);
});

test("HTTP aborts a hanging request at its deadline", async (t) => {
  let aborted = false;
  t.mock.method(
    globalThis,
    "fetch",
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(signal.reason);
          },
          { once: true },
        );
      }),
  );
  await assert.rejects(fetchText(url, { timeout: 10 }), /batas waktu 10 ms/);
  assert.equal(aborted, true);
});

test("HTTP rejects oversized and empty responses", async (t) => {
  mockFetch(t, [new Response(new Uint8Array(8 * 1024 * 1024 + 1)), new Response("  ")]);
  await assert.rejects(fetchText(url), /8 MiB/);
  await assert.rejects(fetchText(url), /respons kosong/);
});

test("HTML links only expose HTTP and HTTPS URLs", () => {
  assert.equal(absoluteUrl("/123", url), "https://repository.mercubuana.ac.id/123");
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "mailto:test@example.org",
    "http://[",
    "",
  ])
    assert.equal(absoluteUrl(href, url), null);
});
