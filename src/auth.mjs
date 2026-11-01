import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getConfig } from "./config.mjs";

function portalCookies(state, now) {
  if (!state || !Array.isArray(state.cookies)) throw new Error("Format sesi Portal tidak valid.");
  return state.cookies.filter((cookie) => {
    if (
      !cookie ||
      typeof cookie.domain !== "string" ||
      typeof cookie.name !== "string" ||
      !cookie.name ||
      typeof cookie.value !== "string" ||
      !cookie.value
    )
      return false;
    const domain = cookie.domain.replace(/^\./, "").toLowerCase();
    return (
      ["mercubuana.ac.id", "portal.mercubuana.ac.id"].includes(domain) &&
      (cookie.expires === -1 || cookie.expires > now / 1000)
    );
  });
}

export function authStatus({ stateFile = getConfig().stateFile, now = Date.now() } = {}) {
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const cookies = portalCookies(state, now);
    return {
      loggedIn: cookies.length ? null : false,
      hasSession: cookies.length > 0,
      verified: false,
      stateFile,
      cookieCount: cookies.length,
      domains: [...new Set(cookies.map((cookie) => cookie.domain))],
      updatedAt: fs.statSync(stateFile).mtime.toISOString(),
      note: "Pemeriksaan file lokal saja. Cookie aktif tidak membuktikan login masih valid di Portal. Sesi ini tidak dikirim ke katalog atau repository.",
    };
  } catch (error) {
    return {
      loggedIn: false,
      hasSession: false,
      verified: false,
      stateFile,
      ...(error.code === "ENOENT"
        ? {
            note: "Belum ada sesi Portal. Jalankan mercy login bila diperlukan.",
          }
        : {
            error:
              "Sesi Portal tidak dapat dibaca atau formatnya tidak valid. Jalankan mercy login untuk memperbaruinya.",
          }),
    };
  }
}

export function savePortalState(state, stateFile = getConfig().stateFile) {
  if (!portalCookies(state, Date.now()).length)
    throw new Error("Tidak ditemukan cookie Portal yang aktif. Sesi tidak disimpan.");
  fs.mkdirSync(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  const temporary = `${stateFile}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(state), {
      mode: 0o600,
      flag: "wx",
    });
    fs.renameSync(temporary, stateFile);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
