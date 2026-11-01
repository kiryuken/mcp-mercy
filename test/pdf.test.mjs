import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { downloadPdf, extractPdf, PDF_MAX_BYTES, readPdf, validatePdfUrl } from "../src/pdf.mjs";
import { pdfReadSchema } from "../src/schemas.mjs";
import { mockFetch } from "./helpers.mjs";
import { pdfFixture } from "./pdf-fixture.mjs";

const url = "https://repository.mercubuana.ac.id/123/1/public.pdf";
const pdf = pdfFixture();
const response = (options) =>
  new Response(pdf, {
    headers: { "content-type": "application/pdf", ...options?.headers },
    ...options,
  });
const params = (extra = {}) => pdfReadSchema.parse({ url, ...extra });

test("PDF URL validation only permits public campus HTTPS origins", () => {
  assert.equal(validatePdfUrl(url + "#page=2"), url);
  assert.equal(
    validatePdfUrl("https://digilib.mercubuana.ac.id/document.pdf"),
    "https://digilib.mercubuana.ac.id/document.pdf",
  );
  for (const value of [
    "invalid",
    "http://repository.mercubuana.ac.id/a.pdf",
    "file:///etc/passwd",
    "https://127.0.0.1/a.pdf",
    "https://repository.mercubuana.ac.id.evil.org/a.pdf",
    "https://user:password@repository.mercubuana.ac.id/a.pdf",
    "https://repository.mercubuana.ac.id:8443/a.pdf",
    "https://portal.mercubuana.ac.id/login",
  ])
    assert.throws(() => validatePdfUrl(value));
});

test("PDF download checks binary signature, computes provenance, and sends no credentials", async (t) => {
  const calls = mockFetch(t, [response()]);
  const result = await downloadPdf(url);
  assert.deepEqual(result.data, pdf);
  assert.equal(result.bytes, pdf.length);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal(calls[0].options.headers.cookie, undefined);
  assert.equal(calls[0].options.headers.authorization, undefined);
});

test("PDF download accepts a same-origin relative redirect", async (t) => {
  const calls = mockFetch(t, [
    new Response(null, { status: 302, headers: { location: "./cover.pdf" } }),
    response(),
  ]);
  const result = await downloadPdf(url);
  assert.equal(result.url, "https://repository.mercubuana.ac.id/123/1/cover.pdf");
  assert.equal(calls.length, 2);
});

test("PDF download rejects an offsite redirect before contacting the target", async (t) => {
  mockFetch(t, [
    new Response(null, { status: 302, headers: { location: "https://127.0.0.1/private" } }),
  ]);
  await assert.rejects(downloadPdf(url), /PDF harus memakai HTTPS/);
});

test("PDF download rejects missing redirect targets and redirect loops", async (t) => {
  mockFetch(t, [
    new Response(null, { status: 302 }),
    ...Array.from(
      { length: 4 },
      () => new Response(null, { status: 301, headers: { location: url } }),
    ),
  ]);
  await assert.rejects(downloadPdf(url), /tidak memiliki tujuan/);
  await assert.rejects(downloadPdf(url), /batas 3 kali/);
});

for (const status of [401, 403, 404, 500]) {
  test(`PDF HTTP ${status} is a failed download without leaking upstream content`, async (t) => {
    mockFetch(t, [new Response("private upstream details", { status })]);
    await assert.rejects(
      downloadPdf(url),
      (error) =>
        error.message.includes(`HTTP ${status}`) &&
        !error.message.includes("private upstream details"),
    );
  });
}

test("PDF download rejects oversized content-length before reading the body", async (t) => {
  mockFetch(t, [new Response(pdf, { headers: { "content-length": String(PDF_MAX_BYTES + 1) } })]);
  await assert.rejects(downloadPdf(url), /20 MiB/);
});

test("PDF download enforces the streaming limit without content-length", async (t) => {
  mockFetch(t, [new Response(new Uint8Array(PDF_MAX_BYTES + 1))]);
  await assert.rejects(downloadPdf(url), /20 MiB/);
});

for (const body of ["<html>Login required</html>", "", "not a PDF"]) {
  test(`PDF download rejects an HTML or empty response: ${body || "empty"}`, async (t) => {
    mockFetch(t, [new Response(body)]);
    await assert.rejects(downloadPdf(url), /bukan PDF/);
  });
}

test("PDF download reports network failures and enforces its deadline", async (t) => {
  mockFetch(t, [new TypeError("fetch failed")]);
  await assert.rejects(downloadPdf(url), /jaringan atau DNS/);
  t.mock.restoreAll();
  t.mock.method(
    globalThis,
    "fetch",
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
  );
  await assert.rejects(downloadPdf(url, { timeout: 10 }), /batas waktu/);
});

test("PDF text extraction returns actual page text, citations, and empty-page status", async (t) => {
  mockFetch(t, [response()]);
  const result = await readPdf({ url });
  assert.equal(result.pageCount, 3);
  assert.equal(result.returnedPages, 3);
  assert.match(result.pages[0].text, /Research methods\nControlled experiment/);
  assert.match(result.pages[1].text, /Accuracy improved/);
  assert.equal(result.pages[0].citation, `${url}#page=1`);
  assert.equal(result.pages[2].textAvailable, false);
  assert.equal(result.next, null);
  assert.equal(result.truncated, false);
});

test("PDF maxPages resumes at the next physical page", async () => {
  const first = await extractPdf(pdf, params({ maxPages: 1 }));
  assert.equal(first.pages.length, 1);
  assert.deepEqual(first.next, { page: 2, pageOffset: 0 });
  const second = await extractPdf(pdf, params({ ...first.next, maxPages: 1 }));
  assert.equal(second.pages[0].number, 2);
});

test("PDF maxChars resumes within a page without losing source text", async () => {
  const full = await extractPdf(pdf, params({ maxPages: 1 }));
  const first = await extractPdf(pdf, params({ maxChars: 8 }));
  assert.equal(first.chars, 8);
  assert.equal(first.pages[0].hasMoreText, true);
  assert.deepEqual(first.next, { page: 1, pageOffset: 8 });
  const continuation = await extractPdf(pdf, params({ ...first.next, maxPages: 1 }));
  assert.equal(first.pages[0].text + continuation.pages[0].text, full.pages[0].text);
  const exact = await extractPdf(pdf, params({ maxChars: full.chars }));
  assert.deepEqual(exact.next, { page: 2, pageOffset: 0 });
});

test("PDF extraction validates page numbers and offsets against the actual document", async () => {
  await assert.rejects(extractPdf(pdf, params({ page: 4 })), /hanya memiliki 3 halaman/);
  await assert.rejects(extractPdf(pdf, params({ pageOffset: 1000 })), /pageOffset/);
});

test("PDF extraction reports invalid binary data as an error", async () => {
  await assert.rejects(
    extractPdf(Buffer.from("%PDF-1.4\ninvalid data"), params()),
    /PDF tidak valid/,
  );
});

test("PDF extraction refuses a password-protected document", async () => {
  // Synthetic blank PDF encrypted with pypdf; no account or publication data.
  const locked = readFileSync(new URL("./fixtures/locked.pdf", import.meta.url));
  await assert.rejects(extractPdf(locked, params()), /memerlukan password/);
});

for (const extra of [
  { page: 0 },
  { pageOffset: -1 },
  { maxPages: 21 },
  { maxChars: 80001 },
  { cookie: "should-not-be-accepted" },
  { url: "https://example.org/paper.pdf" },
]) {
  test(`PDF input is rejected before network access: ${JSON.stringify(extra)}`, async (t) => {
    mockFetch(t, []);
    await assert.rejects(readPdf({ url, ...extra }));
  });
}

class FakeWorker extends EventEmitter {
  static instances = [];
  constructor() {
    super();
    this.stdout = this.stderr = { resume() {} };
    FakeWorker.instances.push(this);
  }
  async terminate() {
    this.terminated = true;
    return 0;
  }
}

test("PDF workers stop at the deadline and recover capacity after failures", async () => {
  await assert.rejects(
    extractPdf(pdf, params(), { WorkerClass: FakeWorker, timeout: 10 }),
    /batas waktu/,
  );
  assert.equal(FakeWorker.instances.at(-1).terminated, true);
  const failed = extractPdf(pdf, params(), { WorkerClass: FakeWorker });
  FakeWorker.instances.at(-1).emit("error", new Error("memory limit"));
  await assert.rejects(failed, /batas resource/);
  const exited = extractPdf(pdf, params(), { WorkerClass: FakeWorker });
  FakeWorker.instances.at(-1).emit("exit", 1);
  await assert.rejects(exited, /berhenti/);
});

test("PDF worker concurrency is bounded and capacity is restored after completion", async () => {
  const first = extractPdf(pdf, params(), { WorkerClass: FakeWorker });
  const firstWorker = FakeWorker.instances.at(-1);
  const second = extractPdf(pdf, params(), { WorkerClass: FakeWorker });
  const secondWorker = FakeWorker.instances.at(-1);
  assert.throws(() => extractPdf(pdf, params(), { WorkerClass: FakeWorker }), /Dua PDF/);
  firstWorker.emit("message", { result: { pageCount: 1 } });
  secondWorker.emit("message", { error: "PDF memerlukan password." });
  assert.equal((await first).pageCount, 1);
  await assert.rejects(second, /password/);
});
