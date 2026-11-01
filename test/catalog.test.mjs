import assert from "node:assert/strict";
import test from "node:test";
import { COLLECTIONS, CATALOG_BASE } from "../src/config.mjs";
import { catalogFields, catalogItem, catalogSearch, parseCatalogTable } from "../src/catalog.mjs";
import { fixture, mockFetch } from "./helpers.mjs";

const form = fixture("catalog-form.html");
const results = fixture("catalog-results.html");

for (const collection of Object.keys(COLLECTIONS)) {
  test(`catalog_fields: ${collection} exposes defaults and options`, async (t) => {
    const calls = mockFetch(t, [form]);
    const result = await catalogFields(collection);
    assert.equal(result.collection, collection);
    assert.equal(calls[0].url, CATALOG_BASE + COLLECTIONS[collection].page);
    assert.deepEqual(result.hidden, { show: "y", session: "public-fixture" });
    assert.equal(result.fields.find((field) => field.name === "Jenis1").default, "Skripsi");
    assert.equal(result.fields.find((field) => field.name === "Catatan1").default, "catatan awal");
    assert.equal(
      result.fields.some((field) => field.name === "Disabled1"),
      false,
    );
  });
}

test("catalog_search follows POST action, preserves defaults and encodes filters", async (t) => {
  const calls = mockFetch(t, [form, results]);
  const result = await catalogSearch("tugas_akhir", { Judul1: "AI & mesin + data" }, 2);
  assert.equal(calls[1].url, `${CATALOG_BASE}results.php?source=catalog`);
  assert.equal(calls[1].options.method, "POST");
  const body = new URLSearchParams(calls[1].options.body);
  assert.equal(body.get("Judul1"), "AI & mesin + data");
  assert.equal(body.get("Jenis1"), "Skripsi");
  assert.equal(body.get("Aktif1"), "on");
  assert.equal(body.has("TidakAktif1"), false);
  assert.equal(body.get("cari"), "Tampilkan");
  assert.equal(result.count, 3);
  assert.equal(result.returned, 2);
  assert.equal(result.truncated, true);
  assert.equal(result.rows[0].Judul, "Pembelajaran & Mesinabaikan");
  assert.equal(result.rows[0].detail_url, `${CATALOG_BASE}data16_view.php?ID_Skripsi=000123`);
  assert.equal(result.rows[0].links.length, 1);
});

test("catalog_search follows GET form and preserves action query", async (t) => {
  const calls = mockFetch(t, [form.replace('method="post"', 'method="get"'), results]);
  const result = await catalogSearch("buku", { Judul1: "AI" }, 100);
  const target = new URL(calls[1].url);
  assert.equal(target.searchParams.get("source"), "catalog");
  assert.equal(target.searchParams.get("Judul1"), "AI");
  assert.equal(calls[1].options.body, undefined);
  assert.equal(result.truncated, false);
});

test("catalog_search does not mistake the search form for a results table", async (t) => {
  mockFetch(t, [form, form + results]);
  const result = await catalogSearch("buku", {}, 100);
  assert.equal(result.rows.length, 3);
  assert.equal(result.headers[1], "Judul");
});

test("catalog parser handles nested tables, navigation and onclick detail links", () => {
  const result = parseCatalogTable(results);
  assert.equal(result.count, 3);
  assert.match(result.rows[2].detail_url, /ID_Skripsi=000789$/);
  assert.equal(result.rows[1].links.length, 1);
});

test("catalog parser recognizes an explicitly empty result", () => {
  assert.equal(parseCatalogTable("<p>Data tidak ditemukan</p>").count, 0);
  assert.equal(parseCatalogTable("<table><tr><th>Judul</th></tr></table>").count, 0);
});

for (const html of ["<title>Just a moment...</title>", "<p>Unexpected maintenance page</p>"]) {
  test(`catalog detects an unrecognized page: ${html}`, () => {
    assert.throws(() => parseCatalogTable(html), /sumber|Sumber/);
  });
}

test("catalog rejects offsite form actions before submission", async (t) => {
  mockFetch(t, [form.replace("results.php?source=catalog", "https://example.org/collect")]);
  await assert.rejects(catalogSearch("buku"), /di luar katalog/);
});

test("catalog rejects an unknown filter before submission", async (t) => {
  mockFetch(t, [form]);
  await assert.rejects(catalogSearch("buku", { wrong: "AI" }), /Filter katalog tidak dikenal/);
});

test("catalog rejects missing forms and unsupported methods", async (t) => {
  mockFetch(t, ["<body>Maintenance</body>", form.replace('method="post"', 'method="delete"')]);
  await assert.rejects(catalogFields("buku"), /Form katalog tidak ditemukan/);
  await assert.rejects(catalogFields("buku"), /Metode form/);
});

test("catalog_item extracts labels and preserves leading zero IDs", async (t) => {
  const calls = mockFetch(t, [fixture("catalog-item.html")]);
  const item = await catalogItem("buku", "000123");
  assert.match(calls[0].url, /ID_Buku=000123$/);
  assert.equal(item.id, "000123");
  assert.equal(item.fields[0].value, "Buku & Teknologi");
  assert.equal(item.text, "");
});

test("catalog_item exposes fallback text without scripts when details are missing", async (t) => {
  mockFetch(t, ["<body>Detail belum tersedia<script>secret script</script></body>"]);
  const item = await catalogItem("tugas_akhir", "123");
  assert.deepEqual(item.fields, []);
  assert.equal(item.text, "Detail belum tersedia");
});

test("catalog validates collection, IDs and limits before network access", async (t) => {
  mockFetch(t, []);
  await assert.rejects(catalogFields("__proto__"));
  await assert.rejects(catalogSearch("buku", {}, 0));
  await assert.rejects(catalogSearch("buku", {}, 101));
  await assert.rejects(catalogItem("jurnal", "123"));
  await assert.rejects(catalogItem("buku", "../123"));
});
