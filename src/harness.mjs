import { fileURLToPath } from "node:url";

export function renderHarnessConfig(
  harness,
  {
    nodePath = process.execPath,
    cliPath = fileURLToPath(new URL("../bin/mercy.mjs", import.meta.url)),
    opencodeV2 = false,
  } = {},
) {
  const command = [nodePath, cliPath, "serve"];
  if (harness === "codex") {
    return `[mcp_servers.mercy]\ncommand = ${JSON.stringify(nodePath)}\nargs = ${JSON.stringify(command.slice(1))}\nstartup_timeout_sec = 15\ntool_timeout_sec = 90\n`;
  }
  let config;
  if (harness === "claude") {
    config = {
      mcpServers: { mercy: { type: "stdio", command: nodePath, args: command.slice(1) } },
    };
  } else if (harness === "opencode") {
    const server = opencodeV2
      ? { type: "local", command, timeout: { startup: 15000, execution: 90000 } }
      : { type: "local", command, enabled: true, timeout: 90000 };
    config = {
      $schema: "https://opencode.ai/config.json",
      mcp: opencodeV2 ? { servers: { mercy: server } } : { mercy: server },
    };
  } else throw new Error("Harness harus opencode, claude, atau codex.");
  return `${JSON.stringify(config, null, 2)}\n`;
}
