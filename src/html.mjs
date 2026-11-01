export const clean = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

export function absoluteUrl(href, base) {
  if (!href) return null;
  try {
    const url = new URL(href, base);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function assertSourcePage($) {
  const title = clean($("title").text());
  if (
    /just a moment|access denied|attention required|service unavailable/i.test(title) ||
    $("#challenge-form").length
  ) {
    throw new Error("Sumber menampilkan halaman pembatasan akses. Coba kembali nanti.");
  }
}
