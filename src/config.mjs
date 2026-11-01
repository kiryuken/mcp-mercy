import os from "node:os";
import path from "node:path";

export const CATALOG_BASE = "https://digilib.mercubuana.ac.id/katalog_meruya/";
export const REPO_BASE = "https://repository.mercubuana.ac.id";
export const PORTAL_BASE = "https://portal.mercubuana.ac.id";

export const COLLECTIONS = Object.freeze({
  jurnal: { page: "c_jurnal.php", label: "Jurnal / Prosiding" },
  tugas_akhir: {
    page: "c_tugas_akhir.php",
    label: "Skripsi / Tesis / Disertasi / Tugas Akhir",
  },
  buku: { page: "c_buku.php", label: "Buku" },
  penelitian: { page: "c_penelitian.php", label: "Penelitian" },
  artikel: { page: "c_artikel.php", label: "Artikel" },
  ebook: { page: "c_ebook.php", label: "E-Book" },
});

export function getConfig(env = process.env) {
  const stateDir = path.resolve(env.MERCUBUANA_STATE_DIR || path.join(os.homedir(), ".mcp-mercy"));
  return {
    stateDir,
    stateFile: path.resolve(
      env.MERCUBUANA_PORTAL_STATE || path.join(stateDir, "portal-state.json"),
    ),
    portalUrl: env.MERCUBUANA_PORTAL_URL || PORTAL_BASE,
    chromePath: env.MERCUBUANA_CHROME,
  };
}
