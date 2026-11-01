import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";
import { pdfReadSchema } from "./schemas.mjs";

export const PDF_MAX_BYTES = 20 * 1024 * 1024;
const PDF_HOSTS = new Set(["repository.mercubuana.ac.id", "digilib.mercubuana.ac.id"]);
let activeWorkers = 0;

export function validatePdfUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL PDF tidak valid.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !PDF_HOSTS.has(url.hostname)
  ) {
    throw new Error(
      "PDF harus memakai HTTPS pada repository.mercubuana.ac.id atau digilib.mercubuana.ac.id, tanpa kredensial atau port khusus.",
    );
  }
  url.hash = "";
  return url.href;
}

export async function downloadPdf(value, { timeout = 30000 } = {}) {
  let url = validatePdfUrl(value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "mcp-mercy",
          accept: "application/pdf,application/octet-stream;q=0.9",
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirect PDF tidak memiliki tujuan.");
        url = validatePdfUrl(new URL(location, url).href);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        if ([401, 403].includes(response.status))
          throw new Error(
            `PDF dibatasi aksesnya (HTTP ${response.status}). Tool hanya membaca dokumen publik tanpa cookie Portal.`,
          );
        throw new Error(`Unduhan PDF gagal: HTTP ${response.status}.`);
      }
      if (Number(response.headers.get("content-length")) > PDF_MAX_BYTES) {
        await response.body?.cancel();
        throw new Error("PDF melebihi batas unduhan 20 MiB.");
      }
      let size = 0;
      const chunks = [];
      for await (const chunk of response.body ?? []) {
        size += chunk.byteLength;
        if (size > PDF_MAX_BYTES) throw new Error("PDF melebihi batas unduhan 20 MiB.");
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks);
      if (!data.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
        throw new Error(
          "Respons sumber bukan PDF. Tautan mungkin mengarah ke halaman login atau pembatasan akses.",
        );
      }
      return { data, url, bytes: size, sha256: createHash("sha256").update(data).digest("hex") };
    }
    throw new Error("Redirect PDF melebihi batas 3 kali.");
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("Unduhan PDF melewati batas waktu.", { cause: error });
    if (error instanceof TypeError)
      throw new Error("Tidak dapat mengunduh PDF. Periksa jaringan atau DNS.", { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function extractPdf(data, params, { WorkerClass = Worker, timeout = 20000 } = {}) {
  if (activeWorkers >= 2)
    throw new Error("Dua PDF sedang diproses. Coba kembali setelah salah satunya selesai.");
  const bytes = new Uint8Array(data);
  const worker = new WorkerClass(new URL("./pdf-worker.mjs", import.meta.url), {
    workerData: { data: bytes, params },
    transferList: [bytes.buffer],
    // Process-only Node flags and custom loaders must not leak into the parser worker.
    execArgv: [],
    stdout: true,
    stderr: true,
    resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
  });
  activeWorkers++;
  worker.stdout.resume();
  worker.stderr.resume();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const done = () => {
        activeWorkers--;
        if (error) reject(error);
        else resolve(result);
      };
      worker.terminate().then(done, done);
    };
    const timer = setTimeout(
      () => finish(new Error("Ekstraksi PDF melewati batas waktu 20 detik.")),
      timeout,
    );
    worker.once("message", (message) =>
      finish(message.error ? new Error(message.error) : null, message.result),
    );
    worker.once("error", () =>
      finish(new Error("PDF tidak dapat diproses dalam batas resource yang tersedia.")),
    );
    worker.once("exit", () =>
      finish(new Error("Proses pembaca PDF berhenti sebelum menghasilkan teks.")),
    );
  });
}

export async function readPdf(params) {
  const validated = pdfReadSchema.parse(params);
  const source = validatePdfUrl(validated.url);
  const downloaded = await downloadPdf(source);
  const result = await extractPdf(downloaded.data, validated);
  return {
    source,
    url: downloaded.url,
    bytes: downloaded.bytes,
    sha256: downloaded.sha256,
    ...result,
    pages: result.pages.map((page) => ({
      ...page,
      citation: `${downloaded.url}#page=${page.number}`,
    })),
    note: "Nomor halaman mengikuti urutan fisik PDF. Teks hasil ekstraksi merupakan data sumber; tata letak tabel, kolom, dan rumus dapat berbeda. Halaman tanpa teks dapat berupa scan, gambar, atau halaman kosong; OCR belum tersedia.",
  };
}
