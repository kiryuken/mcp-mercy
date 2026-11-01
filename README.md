# mcp-mercy

Server [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) untuk menelusuri katalog Digilib dan metadata UMB Repository Universitas Mercu Buana melalui aplikasi AI yang mendukung MCP.

MCP ini menyediakan tujuh tool melalui transport stdio. Pencarian menggunakan halaman dan endpoint publik kampus. Proyek ini merupakan integrasi independen dan tidak berafiliasi secara resmi dengan Universitas Mercu Buana.

## Fitur

| Tool                | Kegunaan                                                              |
| ------------------- | --------------------------------------------------------------------- |
| `catalog_fields`    | Membaca nama field, nilai awal, dan pilihan filter katalog            |
| `catalog_search`    | Mencari jurnal, tugas akhir, buku, penelitian, artikel, dan e-book    |
| `catalog_item`      | Membaca detail tugas akhir atau buku berdasarkan ID                   |
| `repository_search` | Mencari metadata dan tautan dokumen EPrints                           |
| `repository_item`   | Membaca abstrak, penulis, dan label pembatasan akses per file         |
| `repository_oai`    | Mengakses enam operasi OAI-PMH, termasuk pagination dengan token      |
| `auth_status`       | Memeriksa keberadaan sesi Portal lokal tanpa menampilkan nilai cookie |

## Persyaratan

- Node.js 22.22 atau lebih baru; Node.js 24 disarankan.
- npm dan akses HTTPS ke situs kampus.
- Chrome/Chromium dan desktop grafis hanya untuk login Portal opsional.

## Instalasi

Instalasi dari npm, berlaku pada Linux, macOS, dan Windows:

```bash
npm install --global mcp-mercy
mercy --version
```

Alternatif curl untuk Linux/macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/kiryuken/mcp-mercy/main/scripts/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
mercy --help
```

Installer PowerShell, instalasi dari checkout lokal, pembaruan, dan penghapusan dijelaskan di [panduan instalasi](docs/installation.md).

Versi `1.0.0` tersedia di [npm](https://www.npmjs.com/package/mcp-mercy). Instalasi source GitHub dan curl memakai branch `main` repositori ini.

## Konfigurasi klien MCP

Pilih harness yang dipakai setelah instalasi:

| Harness      | Konfigurasi sesuai lokasi instalasi | Panduan                                         |
| ------------ | ----------------------------------- | ----------------------------------------------- |
| OpenCode 1.x | `mercy config opencode`             | [OpenCode](docs/installation.md#opencode)       |
| OpenCode V2  | `mercy config opencode --v2`        | [OpenCode V2](docs/installation.md#opencode-v2) |
| Claude Code  | `mercy config claude`               | [Claude Code](docs/installation.md#claude-code) |
| Codex        | `mercy config codex`                | [Codex](docs/installation.md#codex)             |

`mercy config` mencetak konfigurasi dengan path absolut Node.js dan CLI lokal. Salin atau gabungkan hasilnya ke konfigurasi harness; perintah ini tidak mengubah file konfigurasi Anda. Cara ini juga menghindari masalah PATH dan shim npm pada aplikasi desktop atau Windows.

Jalankan server secara langsung bila diperlukan:

```bash
mercy serve
```

Server memakai stdio dan menunggu pesan MCP di stdin tanpa banner stdout. Binary `mcp-mercy` tetap tersedia untuk kompatibilitas. Contoh konfigurasi statis tersedia di [examples/](examples/).

## Contoh penggunaan

Temukan nama filter terlebih dahulu:

```text
catalog_fields(collection="tugas_akhir")
catalog_search(collection="tugas_akhir", filters={"Judul_Skripsi1":"artificial"}, limit=5)
catalog_item(collection="tugas_akhir", id="0000095312")
repository_search(query="artificial intelligence", page=0, limit=5)
repository_item(eprintId="104728")
repository_oai(verb="Identify")
repository_oai(verb="ListRecords", metadataPrefix="oai_dc", limit=100)
```

ID pada contoh berasal dari record publik dan ketersediaannya dapat berubah. Parameter lengkap dan format hasil dijelaskan di [referensi tool](docs/tools.md).

## Login Portal opsional

Pencarian katalog dan repository tidak memerlukan sesi Portal. Utilitas login membantu menyimpan sesi browser secara lokal untuk diperiksa dengan `auth_status`:

```bash
mercy login
```

CLI menampilkan tautan Portal dan mencoba membuka browser yang didukung pada Linux, macOS, atau Windows. Selesaikan login dan CAPTCHA secara manual, lalu tekan Enter di terminal. State browser disimpan di `~/.mcp-mercy/portal-state.json` dengan izin `0600` pada sistem POSIX. File dapat berisi cookie dan local storage; perlakukan sebagai kredensial.

Jika browser gagal dibuka, CLI mencoba browser bawaan dan tetap menyediakan tautan login. Login melalui tautan/browser bawaan tidak menyalin sesi browser tersebut ke MCP. Pasang browser yang didukung atau set `MERCUBUANA_CHROME`, lalu ulangi `mercy login` untuk menyimpan sesi.

```bash
mercy login --url
mercy status
```

Sesi Portal tidak dikirim dalam permintaan katalog atau repository dan tidak membuka akses PDF yang dibatasi oleh akun EPrints. `auth_status` hanya memeriksa state lokal; `loggedIn: null` berarti sesi tersedia tetapi login belum diverifikasi ke Portal. Detail konfigurasi dan migrasi sesi lama tersedia di [panduan konfigurasi](docs/configuration.md).

## Pengujian

```bash
npm run check
npm run test:coverage
npm run test:live
```

`check` menjalankan lint, pemeriksaan format, dan pengujian offline. Pengujian live terpisah karena membutuhkan jaringan dan bergantung pada layanan kampus. Keduanya menggunakan assertion; kegagalan menghasilkan exit code nonzero.

GitHub Actions dikonfigurasi untuk pemeriksaan offline, coverage, audit dependensi, dan validasi paket pada Node.js 22 serta 24 di Linux, macOS, dan Windows. Pengujian live dapat dijalankan manual dari tab Actions. Lihat [strategi pengujian](docs/testing.md) dan [hasil QA](docs/qa-report.md).

## Struktur proyek

```text
mcp-mercy/
  bin/                  CLI mercy, entry point server, dan utilitas login
  src/                  Implementasi MCP, HTTP, parser, validasi, dan sesi
  scripts/              Installer curl/POSIX dan PowerShell
  test/
    fixtures/           HTML/XML sintetis untuk pengujian offline
    live/               Pengujian layanan kampus melalui klien MCP stdio
    *.test.mjs          Pengujian unit, integrasi, dan CLI
  docs/                 Konfigurasi, referensi tool, pengujian, dan laporan QA
  examples/             Contoh konfigurasi klien
  .github/workflows/    CI dan pengujian live manual
```

## Batasan

- Struktur HTML kampus dapat berubah. Halaman pembatasan akses, respons kosong, atau struktur utama yang tidak dikenali dilaporkan sebagai error.
- Detail tugas akhir dapat hanya menampilkan sebagian metadata. Gunakan hasil pencarian ketika halaman detail tidak lengkap.
- Label pembatasan file bersumber dari HTML, tanpa permintaan atau unduhan PDF. Nilai `restricted: null` berarti akses belum diverifikasi.
- `limit` membatasi output lokal. Pencarian repository mengikuti halaman sumber yang biasanya berisi 20 hasil. Token OAI melanjutkan setelah seluruh batch sumber; periksa `truncated` sebelum melanjutkan.
- Tidak ada crawler, retry otomatis, cache, atau pembatas laju global. Jalankan permintaan secara wajar dan ikuti ketentuan perpustakaan.

## Kontribusi dan lisensi

Panduan pengembangan tersedia di [CONTRIBUTING.md](CONTRIBUTING.md). Penanganan informasi sensitif dijelaskan di [SECURITY.md](SECURITY.md), dan perubahan dicatat di [CHANGELOG.md](CHANGELOG.md).

Kode proyek menggunakan [lisensi ISC](LICENSE). Hak atas metadata, dokumen, dan layanan sumber tetap berada pada pemiliknya.
