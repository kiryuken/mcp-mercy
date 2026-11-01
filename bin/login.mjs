#!/usr/bin/env node
import { runLogin } from "../src/login.mjs";

try {
  process.exitCode = (await runLogin()).saved ? 0 : 1;
} catch (error) {
  console.error(`Login gagal: ${error.message}`);
  process.exitCode = 1;
}
