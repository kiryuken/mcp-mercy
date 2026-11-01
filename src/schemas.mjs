import { z } from "zod";
import { COLLECTIONS } from "./config.mjs";

const collection = z.enum(Object.keys(COLLECTIONS));
const id = z.string().regex(/^\d{1,30}$/, "ID harus berisi 1 sampai 30 digit.");
const text = z.string().trim().min(1).max(2000);
export const catalogFieldsSchema = z.object({ collection });
export const catalogSearchSchema = z.object({
  collection,
  filters: z.record(z.string().min(1).max(100), z.string().max(2000)).default({}),
  limit: z.number().int().min(1).max(100).default(50),
});
export const catalogItemSchema = z.object({
  collection: z.enum(["tugas_akhir", "buku"]),
  id,
});
export const repositorySearchSchema = z.object({
  query: text,
  page: z.number().int().min(0).max(500).default(0),
  limit: z.number().int().min(1).max(50).default(20),
});
export const repositoryItemSchema = z.object({ eprintId: id });
export const oaiSchema = z
  .object({
    verb: z.enum([
      "Identify",
      "ListSets",
      "ListMetadataFormats",
      "ListRecords",
      "ListIdentifiers",
      "GetRecord",
    ]),
    metadataPrefix: text.optional(),
    set: text.optional(),
    from: z.iso.datetime({ precision: 0 }).or(z.iso.date()).optional(),
    until: z.iso.datetime({ precision: 0 }).or(z.iso.date()).optional(),
    identifier: text.optional(),
    resumptionToken: text.optional(),
    limit: z.number().int().min(1).max(500).default(10),
  })
  .strict();

export function validateOai(params) {
  const parsed = oaiSchema.parse(params);
  const { verb, resumptionToken, metadataPrefix, identifier, from, until } = parsed;
  const allowed = {
    Identify: [],
    ListSets: ["resumptionToken"],
    ListMetadataFormats: ["identifier"],
    GetRecord: ["identifier", "metadataPrefix"],
    ListRecords: ["metadataPrefix", "set", "from", "until", "resumptionToken"],
    ListIdentifiers: ["metadataPrefix", "set", "from", "until", "resumptionToken"],
  }[verb];
  for (const key of Object.keys(parsed)) {
    if (!["verb", "limit"].includes(key) && parsed[key] !== undefined && !allowed.includes(key)) {
      throw new Error(`${key} tidak didukung untuk ${verb}.`);
    }
  }
  if (resumptionToken) {
    if (
      Object.entries(parsed).some(
        ([key, value]) =>
          !["verb", "limit", "resumptionToken"].includes(key) && value !== undefined,
      )
    ) {
      throw new Error(
        "resumptionToken tidak boleh digabung dengan parameter OAI lain selain verb.",
      );
    }
  } else if (["ListRecords", "ListIdentifiers", "GetRecord"].includes(verb) && !metadataPrefix) {
    throw new Error(`${verb} memerlukan metadataPrefix, misalnya oai_dc.`);
  }
  if (verb === "GetRecord" && !identifier) throw new Error("GetRecord memerlukan identifier.");
  if (from && until && (from.length !== until.length || from > until)) {
    throw new Error("Rentang from/until harus berurutan dan memakai presisi tanggal yang sama.");
  }
  return parsed;
}
