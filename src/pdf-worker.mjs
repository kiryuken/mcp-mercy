import { parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = new URL("./", import.meta.resolve("pdfjs-dist/package.json"));
const resource = (name) => fileURLToPath(new URL(`${name}/`, root)).replaceAll("\\", "/");
const task = getDocument({
  data: workerData.data,
  verbosity: 0,
  isEvalSupported: false,
  disableFontFace: true,
  useSystemFonts: false,
  useWorkerFetch: false,
  useWasm: false,
  enableXfa: false,
  stopAtErrors: true,
  standardFontDataUrl: resource("standard_fonts"),
  cMapUrl: resource("cmaps"),
  cMapPacked: true,
});
try {
  const pdf = await task.promise;
  const { page: first, pageOffset, maxPages, maxChars } = workerData.params;
  if (first > pdf.numPages) throw new RangeError(`PDF hanya memiliki ${pdf.numPages} halaman.`);
  const pages = [];
  let chars = 0;
  let next = null;
  for (let number = first; number <= Math.min(pdf.numPages, first + maxPages - 1); number++) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const fullText = content.items
      .filter((item) => typeof item.str === "string")
      .map((item) => item.str + (item.hasEOL ? "\n" : " "))
      .join("")
      .split("\n")
      .map((line) => line.replace(/[\t ]+/g, " ").trim())
      .join("\n")
      .trim();
    const offset = number === first ? pageOffset : 0;
    if (offset > fullText.length)
      throw new RangeError(
        `pageOffset melebihi panjang teks halaman ${number} (${fullText.length} karakter).`,
      );
    const text = fullText.slice(offset, offset + maxChars - chars);
    const hasMoreText = offset + text.length < fullText.length;
    pages.push({
      number,
      offset,
      text,
      textLength: fullText.length,
      hasMoreText,
      textAvailable: fullText.length > 0,
    });
    chars += text.length;
    page.cleanup();
    next = hasMoreText
      ? { page: number, pageOffset: offset + text.length }
      : number < pdf.numPages
        ? { page: number + 1, pageOffset: 0 }
        : null;
    if (hasMoreText || chars >= maxChars) break;
  }
  parentPort.postMessage({
    result: {
      pageCount: pdf.numPages,
      returnedPages: pages.length,
      chars,
      pages,
      next,
      truncated: next !== null,
    },
  });
} catch (error) {
  const message =
    error instanceof RangeError
      ? error.message
      : error.name === "PasswordException"
        ? "PDF memerlukan password. Tool ini hanya membaca PDF publik tanpa password."
        : "PDF tidak valid, rusak, atau memakai fitur yang belum dapat diekstrak.";
  parentPort.postMessage({ error: message });
} finally {
  await task.destroy();
}
