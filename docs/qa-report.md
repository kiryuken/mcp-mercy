# Laporan QA mcp-mercy

Tanggal: 2 November 2026 (Asia/Bangkok). Lingkungan: Linux, Node.js 22.22.1 dan 24.14.0. Pemeriksaan mencakup kode server, parser, validasi, state lokal, dependensi, dokumentasi, dan konfigurasi distribusi.

## Ringkasan

Implementasi telah dipisahkan ke modul dengan tanggung jawab yang jelas dan identitas paket diselaraskan menjadi `mcp-mercy`. Setelah penambahan CLI dan installer, 138 pengujian offline lulus pada kedua versi Node.js di Linux; satu tes khusus Windows dilewati sesuai platform. Pengujian layanan kampus pada audit inti sebelumnya lulus, termasuk seluruh koleksi, keenam verb OAI, dan kelanjutan batch. Audit dependensi terakhir tidak menemukan advisori pada dependency tree yang terpasang.

## Hasil verifikasi

| Pemeriksaan                 | Hasil                                                                      |
| --------------------------- | -------------------------------------------------------------------------- |
| Instalasi bersih `npm ci`   | Lulus dari lockfile                                                        |
| ESLint dan Prettier         | Lulus                                                                      |
| Tes offline Node.js 22.22.1 | 138 lulus; 0 gagal; 1 tes Windows dilewati pada Linux                      |
| Tes offline Node.js 24.14.0 | 138 lulus; 0 gagal; 1 tes Windows dilewati pada Linux                      |
| Tes live Node.js 24.14.0    | 18 subtest dan 1 test induk lulus; 0 gagal; 0 dilewati                     |
| Coverage baris `src/`       | 100%                                                                       |
| Coverage branch `src/`      | 93,77%                                                                     |
| Coverage fungsi `src/`      | 97,26%                                                                     |
| `npm audit`                 | 0 critical, 0 high, 0 moderate, 0 low                                      |
| Daftar file distribusi      | Entry point dan modul tersedia; state serta konfigurasi lokal dikecualikan |

Coverage mengukur modul `src/`, termasuk CLI, login, deteksi browser, dan konfigurasi harness. GUI login menggunakan simulasi; keberhasilan login browser dengan akun kampus belum diuji. Konfigurasi CI untuk native macOS dan Windows tersedia, tetapi kedua OS tersebut belum dijalankan di lingkungan Linux ini.

## Verifikasi instalasi dan harness

Tarball hasil `npm pack` dipasang dengan npm ke prefix sementara di `/tmp`, tanpa mengubah instalasi global pengguna. Binary `mercy` hasil instalasi berhasil menampilkan versi, URL login, dan konfigurasi Codex dengan lokasi paket terpasang. Klien SDK berhasil melakukan handshake stdio, membaca tujuh tool, dan memanggil `auth_status` melalui `mercy serve` dari paket tersebut.

Generator konfigurasi mencakup OpenCode 1.x dan V2, Claude Code, serta Codex. Format dibandingkan dengan dokumentasi resmi dan help CLI yang tersedia. Browser kandidat serta pemanggilan pembuka URL Windows/macOS diuji dengan simulasi platform. Installer POSIX diuji dengan npm simulasi untuk memverifikasi quoting path, penolakan argumen tidak valid, dan propagasi kegagalan npm.

Rilis `mcp-mercy@1.0.0` telah diverifikasi tersedia di registry npm dengan tag `latest`. Metadata repository mengarah ke `kiryuken/mcp-mercy`. URL GitHub/curl memakai branch `main`; unduhan installer tersebut belum diuji sebelum push pertama.

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
