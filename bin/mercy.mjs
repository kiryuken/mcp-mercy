#!/usr/bin/env node
import { runCli } from "../src/cli.mjs";

try {
  process.exitCode = await runCli(process.argv.slice(2));
} catch (error) {
  console.error(`mercy: ${error.message}`);
  process.exitCode = 1;
}
