#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../src/server.mjs";

const server = createServer();
async function shutdown() {
  await server.close();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
try {
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error(`mcp-mercy gagal dimulai: ${error.message}`);
  process.exitCode = 1;
}
