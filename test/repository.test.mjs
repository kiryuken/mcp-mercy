import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRepositoryItem,
  parseRepositorySearch,
  repositoryItem,
  repositorySearch,
} from "../src/repository.mjs";
import { fixture, mockFetch } from "./helpers.mjs";

test("repository search parses totals, metadata, fallback titles and unique PDFs", () => {
  const result = parseRepositorySearch(fixture("repository-search.html"));
  assert.equal(result.total, 1234);
  assert.equal(result.count, 2);
  assert.equal(result.items[0].id, "123");
  assert.equal(result.items[0].title, "Penelitian & Teknologi");
  assert.equal(result.items[0].year, "2025");
  assert.equal(result.items[0].author, "Penulis Satu");
  assert.equal(result.items[0].restricted, true);
  assert.equal(result.items[0].pdfs.length, 1);
  assert.equal(result.items[1].id, "124");
  assert.equal(result.items[1].restricted, null);
});

test("repository search encodes queries, applies fixed page offset and local limit", async (t) => {
  const calls = mockFetch(t, [fixture("repository-search.html")]);
  const result = await repositorySearch("AI & ML", 2, 1);
  const target = new URL(calls[0].url);
  assert.equal(target.searchParams.get("q"), "AI & ML");
  assert.equal(target.searchParams.get("search_offset"), "40");
  assert.equal(result.pageSize, 20);
  assert.equal(result.count, 1);
  assert.equal(result.parsedCount, 2);
  assert.equal(result.truncated, true);
});

test("repository search handles empty results and rejects source drift", () => {
  assert.equal(parseRepositorySearch("<p>No results found</p>").count, 0);
  assert.throws(() => parseRepositorySearch("<p>Maintenance</p>"), /tidak dikenali/);
  assert.throws(() => parseRepositorySearch("<title>Access Denied</title>"), /pembatasan akses/);
});

test("repository_item deduplicates files and reports access restrictions per document", async (t) => {
  const calls = mockFetch(t, [fixture("repository-item.html")]);
  const result = await repositoryItem("123");
  assert.match(calls[0].url, /\/id\/eprint\/123$/);
  assert.equal(result.title, "Penelitian Contoh");
  assert.deepEqual(result.authors, ["Penulis Satu", "Penulis Dua"]);
  assert.equal(result.abstract, "Abstrak & metadata contoh.");
  assert.equal(result.files.length, 2);
  assert.equal(result.files[0].text, "Download cover");
  assert.equal(result.files[0].restricted, null);
  assert.equal(result.files[1].restricted, true);
});

test("repository_item handles missing optional metadata and rejects invalid record pages", () => {
  const item = parseRepositoryItem('<meta name="eprints.title" content="Minimal">');
  assert.equal(item.abstract, "");
  assert.deepEqual(item.files, []);
  assert.throws(() => parseRepositoryItem("<body>Record not found</body>"), /Metadata record/);
});

test("repository validates IDs and search boundaries before network access", async (t) => {
  mockFetch(t, []);
  await assert.rejects(repositorySearch("   "));
  await assert.rejects(repositorySearch("AI", -1));
  await assert.rejects(repositorySearch("AI", 501));
  await assert.rejects(repositorySearch("AI", 0, 51));
  await assert.rejects(repositoryItem("123/../../cgi"));
});
