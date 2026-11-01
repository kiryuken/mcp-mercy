import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { authStatus } from "./auth.mjs";
import { catalogFields, catalogItem, catalogSearch } from "./catalog.mjs";
import { repositoryItem, repositorySearch } from "./repository.mjs";
import { repositoryOai } from "./oai.mjs";
import {
  catalogFieldsSchema,
  catalogItemSchema,
  catalogSearchSchema,
  oaiSchema,
  repositoryItemSchema,
  repositorySearchSchema,
} from "./schemas.mjs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

export function createServer() {
  const server = new McpServer({ name: "mcp-mercy", version });
  const tools = [
    [
      "catalog_fields",
      "Tampilkan field dan opsi pencarian katalog Digilib Mercu Buana.",
      catalogFieldsSchema,
      ({ collection }) => catalogFields(collection),
    ],
    [
      "catalog_search",
      "Cari katalog; gunakan catalog_fields untuk nama filters. limit membatasi hasil lokal.",
      catalogSearchSchema,
      ({ collection, filters, limit }) => catalogSearch(collection, filters, limit),
    ],
    [
      "catalog_item",
      "Ambil detail tugas akhir atau buku berdasarkan ID numerik.",
      catalogItemSchema,
      ({ collection, id }) => catalogItem(collection, id),
    ],
    [
      "repository_search",
      "Cari metadata EPrints UMB; page memakai offset sumber 20 hasil. limit membatasi output lokal.",
      repositorySearchSchema,
      ({ query, page, limit }) => repositorySearch(query, page, limit),
    ],
    [
      "repository_item",
      "Ambil metadata, abstrak, dan label pembatasan akses per file. Akses PDF tidak diverifikasi.",
      repositoryItemSchema,
      ({ eprintId }) => repositoryItem(eprintId),
    ],
    [
      "repository_oai",
      "Query OAI-PMH UMB. resumptionToken eksklusif; limit memotong output batch lokal.",
      oaiSchema,
      repositoryOai,
    ],
    [
      "auth_status",
      "Periksa sesi Portal lokal tanpa nilai cookie. Tidak memverifikasi login ke server Portal.",
      {},
      () => authStatus(),
    ],
  ];
  for (const [name, description, inputSchema, handler] of tools) {
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: name !== "auth_status",
        },
      },
      async (args) => {
        try {
          const data = await handler(args);
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            structuredContent: data,
            ...(data.error ? { isError: true } : {}),
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      },
    );
  }
  return server;
}
