import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("live upstream contracts through the MCP stdio client", { timeout: 300000 }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mercy-live-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../../bin/mcp-mercy.mjs", import.meta.url))],
    env: {
      PATH: process.env.PATH,
      MERCUBUANA_PORTAL_STATE: path.join(dir, "missing-state.json"),
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "mercy-live-test", version: "1.0.0" });
  t.after(async () => {
    await client.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 7);
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 90000 });
    assert.notEqual(result.isError, true, `${name}: ${result.content?.[0]?.text}`);
    const data = result.structuredContent;
    assert.ok(data);
    return data;
  };
  await t.test("auth_status works with no stored credentials", async () => {
    assert.equal((await call("auth_status", {})).hasSession, false);
  });
  for (const collection of ["jurnal", "tugas_akhir", "buku", "penelitian", "artikel", "ebook"]) {
    await t.test(`catalog fields and search: ${collection}`, async () => {
      const fields = await call("catalog_fields", { collection });
      const title = fields.fields.find((field) => /judul/i.test(field.name));
      assert.ok(title, "Search form must expose a title field");
      const results = await call("catalog_search", {
        collection,
        filters: { [title.name]: "artificial" },
        limit: 2,
      });
      assert.ok(Array.isArray(results.rows));
      assert.ok(results.returned <= 2);
      assert.equal(results.count >= results.returned, true);
    });
  }
  for (const [collection, id] of [
    ["tugas_akhir", "0000095312"],
    ["buku", "0000019835"],
  ]) {
    await t.test(`catalog detail: ${collection}`, async () => {
      const item = await call("catalog_item", { collection, id });
      assert.equal(item.id, id);
      assert.ok(item.fields.length || item.text.length);
    });
  }
  let eprintId;
  await t.test("repository search returns usable metadata IDs", async () => {
    const result = await call("repository_search", {
      query: "artificial intelligence",
      page: 0,
      limit: 2,
    });
    assert.equal(result.items.length, 2);
    eprintId = result.items[0].id;
    assert.match(eprintId, /^\d+$/);
  });
  await t.test("repository item returns metadata for a search result", async () => {
    assert.ok(eprintId, "Repository search must succeed first");
    const item = await call("repository_item", { eprintId });
    assert.ok(item.title.length > 0);
    assert.ok(Array.isArray(item.authors));
  });
  let recordBatch;
  for (const verb of [
    "Identify",
    "ListSets",
    "ListMetadataFormats",
    "ListRecords",
    "ListIdentifiers",
    "GetRecord",
  ]) {
    await t.test(`OAI-PMH: ${verb}`, async () => {
      const args = { verb, limit: 2 };
      if (verb === "ListRecords") args.limit = 100;
      if (["ListRecords", "ListIdentifiers", "GetRecord"].includes(verb))
        args.metadataPrefix = "oai_dc";
      if (verb === "GetRecord") {
        assert.ok(eprintId, "Repository search must succeed first");
        args.identifier = `oai:repository.mercubuana.ac.id:${eprintId}`;
      }
      const result = await call("repository_oai", args);
      if (verb === "ListRecords") recordBatch = result;
      assert.equal(result.error, null);
      if (verb === "Identify") assert.ok(result.identify.repositoryName);
      else assert.ok(result.records.length > 0);
    });
  }
  await t.test("OAI-PMH: resumptionToken advances to the next batch", async (subtest) => {
    assert.ok(recordBatch, "ListRecords must succeed first");
    if (!recordBatch.resumptionToken) {
      subtest.skip("The source returned a complete batch without a continuation token");
      return;
    }
    const next = await call("repository_oai", {
      verb: "ListRecords",
      resumptionToken: recordBatch.resumptionToken,
      limit: 2,
    });
    assert.ok(next.records.length > 0);
    assert.notEqual(next.records[0].header.identifier, recordBatch.records[0].header.identifier);
  });
});
