import { XMLParser, XMLValidator } from "fast-xml-parser";
import { REPO_BASE } from "./config.mjs";
import { fetchText } from "./http.mjs";
import { validateOai } from "./schemas.mjs";

const asArray = (value) =>
  value == null || value === "" ? [] : Array.isArray(value) ? value : [value];

export function parseOai(xml, verb, limit = 10) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
    throw new Error("Respons OAI-PMH bukan XML yang valid atau mengandung DTD/entity.");
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    textNodeName: "#text",
    trimValues: true,
    parseTagValue: false,
    removeNSPrefix: true,
  }).parse(xml);
  const root = parsed["OAI-PMH"];
  if (!root || typeof root !== "object") throw new Error("Respons tidak memiliki elemen OAI-PMH.");
  const group = root[verb];
  if (!root.error && (!group || typeof group !== "object"))
    throw new Error(`Respons OAI-PMH tidak memiliki hasil ${verb}.`);
  const entry = {
    ListRecords: "record",
    GetRecord: "record",
    ListIdentifiers: "header",
    ListSets: "set",
    ListMetadataFormats: "metadataFormat",
  }[verb];
  const records = asArray(group?.[entry]);
  const token = group?.resumptionToken;
  const errors = asArray(root.error).map((error) => ({
    code: error["@code"] || "unknown",
    message: typeof error === "string" ? error : error["#text"] || "",
  }));
  return {
    verb,
    error: errors.length ? errors : null,
    count: Math.min(records.length, limit),
    parsedCount: records.length,
    records: records.slice(0, limit),
    truncated: records.length > limit,
    resumptionToken: typeof token === "string" ? token : token?.["#text"] || "",
    identify: root.Identify || null,
    note:
      records.length > limit
        ? "limit membatasi output lokal. resumptionToken melanjutkan setelah seluruh batch sumber, termasuk record yang dipotong; naikkan limit untuk menampilkan lebih banyak record batch ini."
        : "Satu permintaan OAI-PMH per pemanggilan; resumptionToken dapat dipakai untuk batch berikutnya.",
  };
}

export async function repositoryOai(params = {}) {
  const validated = validateOai(params);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(validated)) {
    if (key !== "limit" && value !== undefined) query.set(key, value);
  }
  const url = `${REPO_BASE}/cgi/oai2?${query}`;
  const { text } = await fetchText(url, { timeout: 45000 });
  return { url, ...parseOai(text, validated.verb, validated.limit) };
}
