import * as cheerio from "cheerio";
import { REPO_BASE } from "./config.mjs";
import { fetchText } from "./http.mjs";
import { absoluteUrl, assertSourcePage, clean } from "./html.mjs";
import { repositoryItemSchema, repositorySearchSchema } from "./schemas.mjs";

export function parseRepositorySearch(html, limit = 20) {
  const $ = cheerio.load(html);
  assertSourcePage($);
  if (
    !$(".ep_search_result, .ep_search_controls, .ep_search_number").length &&
    !/no (?:results|items)|nothing found/i.test($("body").text())
  ) {
    throw new Error("Hasil pencarian repository tidak dikenali. Struktur sumber mungkin berubah.");
  }
  const items = [];
  $("tr.ep_search_result").each((_, tr) => {
    const row = $(tr);
    const links = row
      .find("a")
      .filter(
        (_, a) =>
          /\/(?:id\/eprint\/)?\d+\/?$/.test($(a).attr("href") || "") &&
          !/\+\d+ more/i.test($(a).text()),
      );
    const emphasized = links.filter((_, a) => $(a).find("em").length > 0).first();
    const link = emphasized.length ? emphasized : links.first();
    const url = absoluteUrl(link.attr("href"), REPO_BASE);
    if (!url || !clean(link.text())) return;
    const rowText = clean(row.text());
    const pdfs = [
      ...new Set(
        row
          .find("a.ep_document_link")
          .toArray()
          .map((a) => absoluteUrl($(a).attr("href"), REPO_BASE))
          .filter((href) => href && /\.pdf($|\?)/i.test(href)),
      ),
    ];
    items.push({
      id: new URL(url).pathname.match(/(\d+)\/?$/)[1],
      title: clean(link.text()),
      author: clean(row.find(".person_name").first().text()),
      year: rowText.match(/\((\d{4})\)/)?.[1] || "",
      type:
        rowText.match(/(S[123] thesis|Thesis|Skripsi|Tesis|Disertasi|Tugas Akhir)[^.]*/i)?.[0] ||
        "",
      url,
      pdfs,
      restricted: /restricted/i.test(rowText) ? true : null,
    });
  });
  const numbers = $(".ep_search_number")
    .map((_, el) => Number(clean($(el).text()).replace(/[,\s]/g, "")))
    .get()
    .filter(Number.isFinite);
  return {
    total: numbers.at(-1) ?? items.length,
    count: Math.min(items.length, limit),
    items: items.slice(0, limit),
    parsedCount: items.length,
    truncated: items.length > limit,
  };
}

export async function repositorySearch(query, page = 0, limit = 20) {
  ({ query, page, limit } = repositorySearchSchema.parse({
    query,
    page,
    limit,
  }));
  const source = `${REPO_BASE}/cgi/search?q=${encodeURIComponent(query)}&search_offset=${page * 20}`;
  const { text } = await fetchText(source);
  return {
    query,
    page,
    pageSize: 20,
    ...parseRepositorySearch(text, limit),
    source,
  };
}

export function parseRepositoryItem(html) {
  const $ = cheerio.load(html);
  assertSourcePage($);
  const metas = (name) =>
    $(`meta[name="eprints.${name}"]`)
      .map((_, el) => clean($(el).attr("content")))
      .get()
      .filter(Boolean);
  const meta = (name) => metas(name)[0] || "";
  const title = meta("title");
  if (!title)
    throw new Error("Metadata record repository tidak ditemukan. Periksa ID atau struktur sumber.");
  const files = [];
  $("a.ep_document_link").each((_, anchor) => {
    const url = absoluteUrl($(anchor).attr("href"), REPO_BASE);
    if (!url) return;
    // Each EPrints document has its own row; one restricted file must not mark the entire item restricted.
    const rowText = clean($(anchor).closest("tr").text());
    const restricted = /restricted|registered users only/i.test(rowText) ? true : null;
    const text = clean($(anchor).text());
    const existing = files.find((file) => file.url === url);
    if (existing) {
      if (text) existing.text = text;
      if (restricted) existing.restricted = true;
    } else files.push({ url, text, restricted });
  });
  return {
    title,
    abstract: meta("abstract"),
    authors: metas("creators_name"),
    date: meta("date"),
    type: meta("type"),
    fullTextStatus: meta("full_text_status"),
    divisions: metas("divisions"),
    institution: meta("institution"),
    files,
    note: "Status file berasal dari label halaman. Nilai null berarti belum diverifikasi; MCP tidak mengunduh atau menguji akses PDF.",
  };
}

export async function repositoryItem(eprintId) {
  repositoryItemSchema.parse({ eprintId });
  const url = `${REPO_BASE}/id/eprint/${eprintId}`;
  const { text } = await fetchText(url);
  return { id: eprintId, url, ...parseRepositoryItem(text) };
}
