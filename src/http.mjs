const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

export async function fetchText(url, { timeout = 30000, ...options } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "mcp-mercy/1.0.0",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...options.headers,
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status} dari ${new URL(url).hostname}.`);
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body ?? []) {
      size += chunk.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        throw new Error("Respons sumber melebihi batas 8 MiB. Persempit pencarian.");
      }
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    if (!text.trim()) throw new Error("Sumber mengembalikan respons kosong.");
    return {
      text,
      contentType: response.headers.get("content-type") || "",
      status: response.status,
    };
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(`Permintaan melewati batas waktu ${timeout} ms.`, {
        cause: error,
      });
    if (error instanceof TypeError) {
      throw new Error(
        `Tidak dapat menghubungi ${new URL(url).hostname}. Periksa jaringan atau DNS.`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
