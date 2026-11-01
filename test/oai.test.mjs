import assert from "node:assert/strict";
import test from "node:test";
import { parseOai, repositoryOai } from "../src/oai.mjs";
import { validateOai } from "../src/schemas.mjs";
import { fixture, mockFetch } from "./helpers.mjs";

test("OAI parses records, deleted headers, repeated creators and leading zero values", () => {
  const result = parseOai(fixture("oai-records.xml"), "ListRecords", 1);
  assert.equal(result.count, 1);
  assert.equal(result.parsedCount, 2);
  assert.equal(result.truncated, true);
  assert.equal(result.records[0].header.setSpec, "000123");
  assert.equal(result.records[0].metadata.dc.identifier, "000123");
  assert.deepEqual(result.records[0].metadata.dc.creator, ["Penulis Satu", "Penulis Dua"]);
  assert.equal(result.resumptionToken, "next:token+1");
  assert.match(result.note, /termasuk record yang dipotong/);
  assert.equal(
    parseOai(fixture("oai-records.xml"), "ListRecords", 50).records[1].header["@status"],
    "deleted",
  );
});

for (const [verb, entry] of [
  ["GetRecord", "record"],
  ["ListIdentifiers", "header"],
  ["ListSets", "set"],
  ["ListMetadataFormats", "metadataFormat"],
]) {
  test(`OAI normalizes a singleton ${verb} and a numeric-looking token`, () => {
    const result = parseOai(
      `<OAI-PMH><${verb}><${entry}><identifier>00123</identifier></${entry}><resumptionToken>00001</resumptionToken></${verb}></OAI-PMH>`,
      verb,
    );
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].identifier, "00123");
    assert.equal(result.resumptionToken, "00001");
    assert.equal(result.truncated, false);
  });
}

test("OAI Identify exposes repository identity", async (t) => {
  const calls = mockFetch(t, [
    "<OAI-PMH><Identify><repositoryName>UMB Repository</repositoryName></Identify></OAI-PMH>",
  ]);
  const result = await repositoryOai({ verb: "Identify" });
  assert.equal(result.identify.repositoryName, "UMB Repository");
  assert.equal(new URL(calls[0].url).searchParams.has("limit"), false);
  assert.equal(result.count, 0);
});

test("OAI surfaces structured protocol errors", () => {
  const result = parseOai(
    '<OAI-PMH><error code="idDoesNotExist">Unknown identifier</error><error code="badArgument">Bad input</error></OAI-PMH>',
    "GetRecord",
  );
  assert.deepEqual(result.error, [
    { code: "idDoesNotExist", message: "Unknown identifier" },
    { code: "badArgument", message: "Bad input" },
  ]);
});

test("OAI serializes resumptionToken exclusively and URL-encodes its value", async (t) => {
  const calls = mockFetch(t, [fixture("oai-records.xml")]);
  await repositoryOai({
    verb: "ListRecords",
    resumptionToken: "next:+/&",
    limit: 1,
  });
  const query = new URL(calls[0].url).searchParams;
  assert.deepEqual([...query.keys()], ["verb", "resumptionToken"]);
  assert.equal(query.get("resumptionToken"), "next:+/&");
});

for (const params of [
  { verb: "GetRecord", metadataPrefix: "oai_dc" },
  { verb: "ListRecords" },
  { verb: "ListRecords", metadataPrefix: "oai_dc", resumptionToken: "token" },
  { verb: "Identify", identifier: "123" },
  { verb: "ListMetadataFormats", resumptionToken: "token" },
  {
    verb: "ListRecords",
    metadataPrefix: "oai_dc",
    from: "2025-02-01",
    until: "2025-01-01",
  },
  {
    verb: "ListRecords",
    metadataPrefix: "oai_dc",
    from: "2025-01-01",
    until: "2025-02-01T00:00:00Z",
  },
  { verb: "ListRecords", metadataPrefix: "oai_dc", from: "2025-02-31" },
  { verb: "Identify", unknown: "ignored?" },
  { verb: "ListRecords", metadataPrefix: "oai_dc", limit: 501 },
]) {
  test(`OAI rejects invalid arguments: ${JSON.stringify(params)}`, async (t) => {
    mockFetch(t, []);
    await assert.rejects(repositoryOai(params));
  });
}

test("OAI accepts complete GetRecord arguments and valid date ranges", () => {
  assert.equal(
    validateOai({
      verb: "GetRecord",
      metadataPrefix: "oai_dc",
      identifier: "oai:umb:123",
    }).limit,
    10,
  );
  assert.equal(
    validateOai({ verb: "ListSets", resumptionToken: "token" }).resumptionToken,
    "token",
  );
  assert.equal(
    validateOai({ verb: "ListRecords", metadataPrefix: "oai_dc", limit: 500 }).limit,
    500,
  );
  assert.equal(
    validateOai({
      verb: "ListRecords",
      metadataPrefix: "oai_dc",
      from: "2025-01-01",
      until: "2025-02-01",
    }).from,
    "2025-01-01",
  );
});

for (const xml of [
  "<broken>",
  "<html><body>Maintenance</body></html>",
  '<!DOCTYPE foo [<!ENTITY x "expand">]><OAI-PMH/>',
  "<OAI-PMH><Identify>wrong verb</Identify></OAI-PMH>",
]) {
  test(`OAI rejects malformed or unexpected XML: ${xml.slice(0, 45)}`, () => {
    assert.throws(() => parseOai(xml, "ListRecords"));
  });
}
