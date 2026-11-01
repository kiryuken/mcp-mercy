import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.mjs";
import { fixture, mockFetch } from "./helpers.mjs";

async function connect(t) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  const client = new Client({ name: "mercy-test", version: "1.0.0" });
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

test("MCP initializes with mcp-mercy identity and advertises seven read-only tools", async (t) => {
  const client = await connect(t);
  assert.equal(client.getServerVersion().name, "mcp-mercy");
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    "auth_status",
    "catalog_fields",
    "catalog_item",
    "catalog_search",
    "repository_item",
    "repository_oai",
    "repository_search",
  ]);
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.inputSchema.type, "object");
  }
});

for (const [name, args, responses, verify] of [
  [
    "catalog_fields",
    { collection: "buku" },
    [fixture("catalog-form.html")],
    (data) => assert.ok(data.fields.length > 0),
  ],
  [
    "catalog_search",
    { collection: "buku", filters: { Judul1: "AI" }, limit: 1 },
    [fixture("catalog-form.html"), fixture("catalog-results.html")],
    (data) => assert.equal(data.returned, 1),
  ],
  [
    "catalog_item",
    { collection: "buku", id: "123" },
    [fixture("catalog-item.html")],
    (data) => assert.equal(data.fields[0].value, "Buku & Teknologi"),
  ],
  [
    "repository_search",
    { query: "AI", limit: 1 },
    [fixture("repository-search.html")],
    (data) => assert.equal(data.items.length, 1),
  ],
  [
    "repository_item",
    { eprintId: "123" },
    [fixture("repository-item.html")],
    (data) => assert.equal(data.files[1].restricted, true),
  ],
  [
    "repository_oai",
    { verb: "ListRecords", metadataPrefix: "oai_dc", limit: 1 },
    [fixture("oai-records.xml")],
    (data) => assert.equal(data.records.length, 1),
  ],
]) {
  test(`MCP ${name} executes with matching text and structured output`, async (t) => {
    mockFetch(t, responses);
    const client = await connect(t);
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true);
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    verify(result.structuredContent);
  });
  test(`MCP ${name} returns isError on an upstream failure`, async (t) => {
    mockFetch(t, [new Response("upstream private details", { status: 503 })]);
    const client = await connect(t);
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /HTTP 503/);
    assert.doesNotMatch(result.content[0].text, /private details/);
  });
}

test("MCP auth_status inspects an isolated local path without HTTP requests", async (t) => {
  mockFetch(t, []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mercy-mcp-test-"));
  const previous = process.env.MERCUBUANA_PORTAL_STATE;
  process.env.MERCUBUANA_PORTAL_STATE = path.join(dir, "portal-state.json");
  t.after(() => {
    if (previous === undefined) delete process.env.MERCUBUANA_PORTAL_STATE;
    else process.env.MERCUBUANA_PORTAL_STATE = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const client = await connect(t);
  const result = await client.callTool({ name: "auth_status", arguments: {} });
  assert.equal(result.structuredContent.hasSession, false);
  assert.equal(result.structuredContent.verified, false);
});

for (const [name, args] of [
  ["catalog_fields", { collection: "unknown" }],
  ["catalog_search", { collection: "buku", limit: 101 }],
  ["catalog_item", { collection: "buku", id: "../123" }],
  ["repository_search", { query: "  " }],
  ["repository_item", { eprintId: "abc" }],
  ["repository_oai", { verb: "GetRecord" }],
]) {
  test(`MCP ${name} rejects invalid input before HTTP`, async (t) => {
    mockFetch(t, []);
    const client = await connect(t);
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true);
  });
}

test("MCP surfaces an OAI protocol error as a failed tool result", async (t) => {
  mockFetch(t, ['<OAI-PMH><error code="noRecordsMatch">No matching records</error></OAI-PMH>']);
  const client = await connect(t);
  const result = await client.callTool({
    name: "repository_oai",
    arguments: { verb: "ListRecords", metadataPrefix: "oai_dc" },
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.error[0].code, "noRecordsMatch");
});

test("MCP reports unknown tools as errors", async (t) => {
  const client = await connect(t);
  const result = await client.callTool({ name: "unknown_tool", arguments: {} });
  assert.equal(result.isError, true);
});
