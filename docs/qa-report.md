# Laporan QA mcp-mercy

Tanggal: 2 November 2026 (Asia/Bangkok). Lingkungan: Linux, Node.js 22.22.1 dan 24.14.0. Pemeriksaan mencakup kode server, parser, validasi, state lokal, dependensi, dokumentasi, dan konfigurasi distribusi.

## Ringkasan

Source versi `1.1.0` menambahkan pembacaan PDF publik dengan pagination teks dan citation per halaman. Sebanyak 170 pengujian offline lulus pada Node.js 22 dan 24 di Linux; satu tes khusus Windows dilewati sesuai platform. Pembacaan PDF publik juga lulus melalui paket tarball terpasang dan klien MCP stdio. Suite live awal mengalami timeout pencarian repository; pemeriksaan ulang tiga alur yang terdampak berhasil. Audit dependensi tidak menemukan advisori.

## Hasil verifikasi

| Pemeriksaan                        | Hasil                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Instalasi bersih `npm ci`          | Lulus dari lockfile                                                        |
| ESLint dan Prettier                | Lulus                                                                      |
| Tes offline Node.js 22.22.1        | 170 lulus; 0 gagal; 1 tes Windows dilewati pada Linux                      |
| Tes offline Node.js 24.14.0        | 170 lulus; 0 gagal; 1 tes Windows dilewati pada Linux                      |
| Suite live awal                    | 16 lulus; 4 gagal termasuk test induk; pemicu: timeout repository search   |
| Pemeriksaan ulang alur terdampak   | `repository_search`, `repository_item`, dan OAI `GetRecord` lulus          |
| PDF publik melalui paket terpasang | Lulus; PDF 18 halaman, 2 halaman dibaca dengan citation                    |
| Coverage baris `src/`              | 99,92%                                                                     |
| Coverage branch `src/`             | 94,09%                                                                     |
| Coverage fungsi `src/`             | 97,78%                                                                     |
| `npm audit`                        | 0 critical, 0 high, 0 moderate, 0 low                                      |
| Daftar file distribusi             | Entry point dan modul tersedia; state serta konfigurasi lokal dikecualikan |

Coverage mengukur modul `src/`, termasuk CLI, login, deteksi browser, dan konfigurasi harness. GUI login menggunakan simulasi; keberhasilan login browser dengan akun kampus belum diuji. Konfigurasi CI untuk native macOS dan Windows tersedia, tetapi kedua OS tersebut belum dijalankan di lingkungan Linux ini.

## Verifikasi instalasi dan harness

Tarball `mcp-mercy@1.1.0` hasil `npm pack` dipasang dengan npm ke prefix sementara di `/tmp`, tanpa mengubah instalasi global pengguna. Klien SDK berhasil melakukan handshake stdio, membaca delapan tool, dan memanggil `pdf_read` melalui `mercy serve` dari paket terpasang. PDF publik asli memiliki 18 halaman; dua halaman pertama menghasilkan 748 karakter dengan nomor halaman dan citation. Stdout tetap berupa pesan MCP dan stderr tidak memuat keluaran parser.

Generator konfigurasi mencakup OpenCode 1.x dan V2, Claude Code, serta Codex. Format dibandingkan dengan dokumentasi resmi dan help CLI yang tersedia. Browser kandidat serta pemanggilan pembuka URL Windows/macOS diuji dengan simulasi platform. Installer POSIX diuji dengan npm simulasi untuk memverifikasi quoting path, penolakan argumen tidak valid, dan propagasi kegagalan npm.

Rilis `mcp-mercy@1.0.0` telah diverifikasi tersedia di registry npm. Source `1.1.0` disiapkan untuk rilis berikutnya dan belum dipublikasikan dalam pekerjaan ini. Metadata repository mengarah ke `kiryuken/mcp-mercy`.

## Verifikasi pembaca PDF

`test/pdf.test.mjs` memakai PDF sintetis dengan beberapa halaman teks dan halaman kosong, serta PDF terkunci sintetis dari pypdf. Ekstraksi memakai worker PDF.js asli. Tes memeriksa rentang halaman, penyambungan potongan teks pada halaman yang sama, citation, SHA-256, PDF rusak/berpassword, respons HTML, HTTP 401/403, URL di luar host yang didukung, redirect, ukuran unduhan, timeout, dan kapasitas worker.

Ekstraksi diberi batas 20 MiB unduhan, 30 detik jaringan, 20 detik pemrosesan, dan dua worker bersamaan. Teks diproses di memori. Worker menerima bytes yang sudah diunduh; cookie Portal dan URL eksternal tidak diteruskan ke parser. PDF.js memakai resource font lokal dan menonaktifkan evaluasi JavaScript serta fetch resource worker.

Suite live pertama memicu timeout 30 detik pada `repository_search`. Dua subtest yang memerlukan ID hasil pencarian dan test induk ikut gagal; tes PDF publik tetap lulus. Pemeriksaan ulang terarah kemudian berhasil untuk pencarian, detail repository, dan OAI `GetRecord`. Hasil awal tetap dicatat; suite live tidak dianggap lulus penuh pada percobaan pertama.

Belum ada OCR atau rekonstruksi tabel/rumus. Nomor halaman mengikuti urutan fisik PDF. Pengujian native macOS/Windows masih bergantung pada CI GitHub.

## Penilaian internal

| Kategori          | Skor     | Dasar penilaian                                                              |
| ----------------- | -------- | ---------------------------------------------------------------------------- |
| Keamanan          | 90/100   | Validasi input, state privat, dan audit bersih; login GUI belum diverifikasi |
| Cakupan pengujian | 100/100  | Coverage tinggi, integrasi protokol, dan uji layanan asli                    |
| Penanganan error  | 95/100   | Status HTTP, timeout, struktur sumber, serta error OAI diuji                 |
| Kualitas kode     | 90/100   | Modul terpisah, lint, format, dan dokumentasi kontrak                        |
| Performa          | 80/100   | Timeout dan batas respons tersedia; belum ada benchmark beban                |
| Dependensi        | 100/100  | Lockfile konsisten dan audit tanpa advisori saat pemeriksaan                 |
| Rata-rata         | 92,5/100 | Penilaian berdasarkan ruang lingkup yang diuji                               |

## Temuan kritis

Tidak ada temuan kritis yang tersisa dari pemeriksaan ini.

## Temuan penting yang diperbaiki

### Status file repository dinilai secara global

Lokasi perbaikan: [src/repository.mjs, baris 100](../src/repository.mjs#L100).

Sebelumnya, label restricted pada salah satu bab memengaruhi semua file karena pemeriksaan memakai teks seluruh halaman:

```js
restricted: /Restricted to Registered users only/i.test(bodyText);
```

Sekarang pemeriksaan dilakukan pada baris dokumen masing-masing. Status yang belum diverifikasi memakai `null`:

```js
const rowText = clean($(anchor).closest("tr").text());
const restricted = /restricted|registered users only/i.test(rowText) ? true : null;
```

Fixture cover dan bab restricted, serta respons sumber asli, memverifikasi perbaikannya.

### Pencarian katalog mengabaikan metode dan action form

Lokasi perbaikan: [src/catalog.mjs, baris 132](../src/catalog.mjs#L132).

Sebelumnya semua pencarian dikirim sebagai POST ke halaman awal:

```js
await fetchText(pageUrl, { method: "POST", body: body.toString() });
```

Sekarang target diambil dari action form, dibatasi pada direktori katalog, dan metode GET/POST diikuti sesuai sumber. Nilai awal form dipertahankan sebelum filter diterapkan:

```js
const target = new URL(form.action, pageUrl);
const body = new URLSearchParams(form.defaults);
```

Tes mencakup action dengan query, GET, POST, field tak dikenal, dan action di luar origin.

### Status cookie dianggap sebagai bukti login

Lokasi perbaikan: [src/auth.mjs, baris 26](../src/auth.mjs#L26).

Sebelumnya keberadaan cookie apa pun menghasilkan status login positif:

```js
loggedIn: cookies.length > 0;
```

Sekarang hanya cookie Portal yang sesuai domain dan belum kedaluwarsa yang dihitung. Status sesi lokal dibedakan dari verifikasi login:

```js
loggedIn: cookies.length ? null : false;
hasSession: cookies.length > 0;
verified: false;
```

Tes menggunakan state sementara, jam terkontrol, cookie domain lain, dan JSON rusak. Nilai cookie tidak masuk ke respons.

### State sesi berpotensi ditulis sebelum izin privat diterapkan

Lokasi perbaikan: [src/auth.mjs, baris 58](../src/auth.mjs#L58).

Sebelumnya browser menulis langsung ke tujuan sebelum `chmod`:

```js
await context.storageState({ path: STATE_FILE });
fs.chmodSync(STATE_FILE, 0o600);
```

Sekarang state ditulis ke file sementara privat, lalu diganti secara atomik:

```js
fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600, flag: "wx" });
fs.renameSync(temporary, stateFile);
```

Tes memeriksa mode file, direktori baru, penggantian file lama, dan penolakan state tidak valid tanpa menimpa sesi sebelumnya.

### Parameter dan tipe metadata OAI tidak cukup dijaga

Lokasi perbaikan: [src/schemas.mjs, baris 43](../src/schemas.mjs#L43) dan [src/oai.mjs, baris 9](../src/oai.mjs#L9).

Sebelumnya parameter langsung diserialisasi dan parser memakai konversi nilai tag bawaan. Kombinasi `resumptionToken` dengan filter lain dapat dikirim, dan identifier numerik dapat kehilangan nol di depan.

Sekarang parameter divalidasi per verb, token bersifat eksklusif, rentang tanggal diperiksa, dan XML mempertahankan nilai string:

```js
const validated = validateOai(params);
// Opsi XMLParser:
parseTagValue: false;
```

Tes memeriksa singleton, deleted record, nilai numerik, XML tidak valid, error protokol, dan pagination token pada layanan asli. Peringatan truncation menjelaskan record batch yang dipotong oleh limit lokal.

### Pengujian lama hanya mencetak hasil

Skrip awal tidak memiliki assertion yang dapat menjamin bentuk respons dan beberapa error hanya dicatat sebelum proses berlanjut. Skrip tersebut diganti dengan `node:test`, assertion kontrak, dan exit code nonzero saat gagal.

Unit test berjalan tanpa internet. Integrasi MCP menguji hasil terstruktur serta `isError`, dan tes stdio memastikan entry point bekerja dari working directory lain.

## Pemeriksaan keamanan dan dependensi

| Area                  | Hasil                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| Input dan path record | Enum, ID numerik, limit, dan kombinasi argumen divalidasi                   |
| State sensitif        | Nilai cookie tidak dikembalikan; file baru memakai mode privat              |
| Permintaan publik     | Cookie Portal tidak diteruskan ke katalog/repository                        |
| Tautan HTML           | Hanya HTTP/HTTPS yang dikembalikan parser                                   |
| XML                   | XML rusak serta deklarasi DTD/entity ditolak                                |
| Respons HTTP          | Timeout dan batas 8 MiB diuji; isi respons error upstream tidak ditampilkan |
| Laju permintaan       | Tes live berurutan; tidak ada throttle global atau retry otomatis           |
| Distribusi            | `.env`, state, konfigurasi agen, dan `node_modules` dikecualikan            |

Audit awal dependensi runtime bersih. Saat tooling ditambahkan, audit mendeteksi advisori `minimatch`; override ke versi yang sudah ditambal menutup advisori tersebut. Alasannya dicatat di [panduan kontribusi](../CONTRIBUTING.md).

## Perbaikan cepat yang selesai

- Nama paket, binary, dan server konsisten sebagai `mcp-mercy`.
- Entry point paket mengarah ke file yang tersedia.
- Lockfile diperbarui dan instalasi bersih berhasil.
- Dokumentasi tidak memuat path komputer pengembang atau emoji.
- CI offline dan workflow live manual tersedia.
- Izin executable CLI dan pengecualian file lokal sudah disiapkan.

## Tindak lanjut pemeliharaan

Periksa login GUI secara manual bila memakai fitur sesi. Pantau perubahan HTML kampus melalui workflow live dan tambahkan fixture regresi bila struktur berubah. Evaluasi penghapusan override `minimatch` setelah dependensi upstream memakai versi aman. Benchmark dan throttle global dapat ditambahkan bila penggunaan bersamaan menjadi kebutuhan.

Keberhasilan pengujian live menggambarkan kondisi sumber saat pemeriksaan. PDF dan resource yang dilindungi tetap mengikuti izin layanan kampus.
