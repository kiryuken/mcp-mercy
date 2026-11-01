import * as cheerio from "cheerio";
import { CATALOG_BASE, COLLECTIONS } from "./config.mjs";
import { fetchText } from "./http.mjs";
import { absoluteUrl, assertSourcePage, clean } from "./html.mjs";
import { catalogFieldsSchema, catalogItemSchema, catalogSearchSchema } from "./schemas.mjs";

function parseForm(html) {
  const $ = cheerio.load(html);
  assertSourcePage($);
  const form = $("form").first();
  if (!form.length)
    throw new Error("Form katalog tidak ditemukan. Struktur sumber mungkin berubah.");
  const fields = [];
  const hidden = {};
  const defaults = {};
  form.find("input, select, textarea, button").each((_, element) => {
    const el = $(element);
    const name = el.attr("name");
    if (!name || el.is(":disabled")) return;
    const tag = element.tagName.toLowerCase();
    const type = (
      el.attr("type") || (tag === "button" ? "submit" : tag === "select" ? "select" : "text")
    ).toLowerCase();
    if (["reset", "button", "file"].includes(type)) return;
    let value = String(el.val() ?? "");
    if (["checkbox", "radio"].includes(type)) value = el.attr("value") ?? "on";
    const field = { name, type, default: value };
    if (tag === "select") {
      field.options = el
        .find("option")
        .map((_, option) => ({
          value: $(option).attr("value") ?? $(option).text(),
          label: clean($(option).text()),
        }))
        .get();
    }
    fields.push(field);
    if (type === "hidden") hidden[name] = value;
    if (type !== "submit" && (!["checkbox", "radio"].includes(type) || el.is(":checked")))
      defaults[name] = value;
  });
  const method = (form.attr("method") || "get").toLowerCase();
  if (!["get", "post"].includes(method))
    throw new Error(`Metode form katalog tidak didukung: ${method}.`);
  return {
    action: form.attr("action") || "",
    method,
    fields,
    hidden,
    defaults,
  };
}

export function parseCatalogTable(html) {
  const $ = cheerio.load(html);
  assertSourcePage($);
  let best;
  $("table").each((_, table) => {
    const rows = $(table)
      .find("tr")
      .filter((_, tr) => $(tr).closest("table")[0] === table);
    const headerIndex = rows.toArray().findIndex(
      (tr) =>
        !$(tr).find("input,select,textarea").length &&
        $(tr)
          .children("th,td")
          .toArray()
          .some((cell) => /^judul\b/i.test(clean($(cell).text()))),
    );
    if (headerIndex < 0) return;
    const headers = $(rows[headerIndex])
      .children("th,td")
      .map((_, cell) => clean($(cell).text()))
      .get();
    const dataRows = rows.slice(headerIndex + 1);
    if (!best || dataRows.length > best.trs.length) best = { headers, trs: dataRows };
  });
  if (!best) {
    if (/tidak (?:ada|ditemukan)|no (?:results|records)|0 (?:record|data)/i.test($("body").text()))
      return { headers: [], rows: [], count: 0 };
    throw new Error("Tabel hasil katalog tidak ditemukan. Struktur sumber mungkin berubah.");
  }
  const rows = [];
  best.trs.each((_, tr) => {
    const cells = $(tr)
      .children("td")
      .map((_, cell) => clean($(cell).text()))
      .get();
    if (cells.length !== best.headers.length || !cells.some(Boolean)) return;
    const row = Object.fromEntries(
      best.headers.map((header, i) => [header || `col${i + 1}`, cells[i]]),
    );
    row.links = [];
    $(tr)
      .find("a")
      .each((_, anchor) => {
        const raw = $(anchor).attr("href") || "";
        const popup = raw.match(/openWindow(?:1)?\(['"]([^'"]+)/i);
        const url = absoluteUrl(popup?.[1] || raw, CATALOG_BASE);
        if (url) row.links.push({ text: clean($(anchor).text()), url });
      });
    const detail = row.links.find((link) => /data1[36]_view\.php/i.test(link.url));
    if (detail) row.detail_url = detail.url;
    else {
      const match = ($(tr).html() || "").match(
        /data(13|16)_view\.php\?(ID_Skripsi|ID_Buku)=([0-9]+)/i,
      );
      if (match) row.detail_url = `${CATALOG_BASE}data${match[1]}_view.php?${match[2]}=${match[3]}`;
    }
    rows.push(row);
  });
  return { headers: best.headers, rows, count: rows.length };
}

export async function catalogFields(collection) {
  catalogFieldsSchema.parse({ collection });
  const meta = COLLECTIONS[collection];
  const page = CATALOG_BASE + meta.page;
  const { text } = await fetchText(page);
  const form = parseForm(text);
  return {
    collection,
    label: meta.label,
    page,
    method: form.method,
    fields: form.fields,
    hidden: form.hidden,
    note: "Gunakan nama field ini sebagai key pada filters catalog_search.",
  };
}

export async function catalogSearch(collection, filters = {}, limit = 50) {
  ({ collection, filters, limit } = catalogSearchSchema.parse({
    collection,
    filters,
    limit,
  }));
  const meta = COLLECTIONS[collection];
  const pageUrl = CATALOG_BASE + meta.page;
  const { text: pageHtml } = await fetchText(pageUrl);
  const form = parseForm(pageHtml);
  const target = new URL(form.action, pageUrl);
  if (
    target.origin !== new URL(CATALOG_BASE).origin ||
    !target.pathname.startsWith(new URL(CATALOG_BASE).pathname)
  ) {
    throw new Error("Action form berada di luar katalog yang diizinkan.");
  }
  const names = new Set(form.fields.map((field) => field.name));
  const body = new URLSearchParams(form.defaults);
  if (!body.has("show")) body.set("show", "y");
  for (const [key, value] of Object.entries(filters)) {
    if (!names.has(key))
      throw new Error(`Filter katalog tidak dikenal: ${key}. Gunakan catalog_fields.`);
    body.set(key, value);
  }
  const submit = form.fields.find((field) => field.type === "submit");
  if (submit && !body.has(submit.name)) body.set(submit.name, submit.default);
  const options = {};
  if (form.method === "post") {
    options.method = "POST";
    options.headers = { "content-type": "application/x-www-form-urlencoded" };
    options.body = body.toString();
  } else {
    for (const [key, value] of body) target.searchParams.set(key, value);
  }
  const { text } = await fetchText(target.href, options);
  const parsed = parseCatalogTable(text);
  const rows = parsed.rows.slice(0, limit);
  return {
    collection,
    label: meta.label,
    filters,
    count: parsed.count,
    returned: rows.length,
    headers: parsed.headers,
    rows,
    truncated: parsed.count > limit,
  };
}

export async function catalogItem(collection, id) {
  catalogItemSchema.parse({ collection, id });
  const entry =
    collection === "buku"
      ? { page: "data13_view.php", param: "ID_Buku" }
      : { page: "data16_view.php", param: "ID_Skripsi" };
  const url = `${CATALOG_BASE}${entry.page}?${entry.param}=${encodeURIComponent(id)}`;
  const { text } = await fetchText(url);
  const $ = cheerio.load(text);
  assertSourcePage($);
  const fields = $("td.tarr")
    .map((_, td) => ({
      label: clean($(td).text()),
      value: clean($(td).next("td.tarr1").text()),
    }))
    .get();
  const hasFields = fields.some((field) => field.value);
  $("script, style").remove();
  return {
    collection,
    id,
    url,
    fields: hasFields ? fields : [],
    text: hasFields ? "" : clean($("body").text()).slice(0, 3000),
    note: hasFields
      ? "Detail record dibaca dari halaman data view."
      : "Halaman detail tidak menampilkan field; gunakan hasil catalog_search.",
  };
}
