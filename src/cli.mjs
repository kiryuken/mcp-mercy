import { readFileSync } from "node:fs";
import { authStatus } from "./auth.mjs";
import { runLogin, portalUrl } from "./login.mjs";
import { renderHarnessConfig } from "./harness.mjs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const HELP = `mercy ${version} - MCP Mercu Buana

Penggunaan:
  mercy serve                  Jalankan server MCP stdio
  mercy login                  Buka browser untuk login Portal manual
  mercy login --url            Tampilkan tautan login tanpa membuka browser
  mercy status                 Periksa file sesi lokal tanpa nilai cookie
  mercy config opencode        Tampilkan konfigurasi OpenCode 1.x
  mercy config opencode --v2   Tampilkan konfigurasi OpenCode V2
  mercy config claude          Tampilkan konfigurasi Claude Code
  mercy config codex           Tampilkan konfigurasi Codex (TOML)
  mercy --version              Tampilkan versi
  mercy --help                 Tampilkan panduan

Konfigurasi memakai path absolut instalasi ini dan tidak mengubah file harness.
`;

export async function runCli(
  args,
  {
    output = process.stdout,
    login = runLogin,
    serve = async () => {
      await import("../bin/mcp-mercy.mjs");
    },
  } = {},
) {
  const [command, ...rest] = args;
  if (!command || ["--help", "-h", "help"].includes(command)) {
    output.write(HELP);
    return 0;
  }
  if (["--version", "-v"].includes(command) && !rest.length) {
    output.write(`${version}\n`);
    return 0;
  }
  if (command === "serve" && !rest.length) {
    await serve();
    return 0;
  }
  if (command === "login") {
    if (rest.length === 1 && rest[0] === "--url") {
      output.write(`${portalUrl()}\n`);
      return 0;
    }
    if (!rest.length) return (await login()).saved ? 0 : 1;
  }
  if (command === "status" && !rest.length) {
    const status = authStatus();
    output.write(`${JSON.stringify(status, null, 2)}\n`);
    return status.error ? 1 : 0;
  }
  if (
    command === "config" &&
    rest.length >= 1 &&
    rest.length <= 2 &&
    (rest.length === 1 || (rest[0] === "opencode" && rest[1] === "--v2"))
  ) {
    output.write(renderHarnessConfig(rest[0], { opencodeV2: rest[1] === "--v2" }));
    return 0;
  }
  throw new Error("Perintah atau opsi tidak dikenal. Jalankan mercy --help.");
}
