# Strategi pengujian

## Pemeriksaan lokal

| Perintah                           | Cakupan                                         | Jaringan |
| ---------------------------------- | ----------------------------------------------- | -------- |
| `npm test`                         | Unit, integrasi tool, validasi input, CLI stdio | Tidak    |
| `npm run test:coverage`            | Tes offline dan coverage modul `src/`           | Tidak    |
| `npm run lint`                     | Aturan ESLint untuk kode dan tes                | Tidak    |
| `npm run format:check`             | Konsistensi format kode dan dokumentasi         | Tidak    |
| `npm run check`                    | Lint, format, dan tes offline                   | Tidak    |
| `npm run test:live`                | Tool MCP terhadap layanan kampus asli           | Ya       |
| `npm audit --audit-level=moderate` | Advisori seluruh dependensi                     | Ya       |
| `npm pack --dry-run`               | Daftar file paket distribusi                    | Tidak    |

## Unit dan regresi

Pengujian memakai `node:test`, `node:assert/strict`, HTML/XML sintetis, dan mock pada `fetch`. Tidak ada ketergantungan pada cookie pengguna atau layanan kampus untuk tes default.

Kasus utama yang diuji:

- Seluruh koleksi katalog, pilihan select, hidden field, nilai awal, metode GET/POST, dan action form.
- Encoding query, ID dengan nol di depan, field detail, tabel bersarang, tautan popup, hasil kosong, dan struktur sumber yang tidak dikenali.
- Metadata repository, total pencarian, deduplikasi PDF, pagination, dan pembatasan per file.
- Seluruh bentuk respons OAI, deleted record, token, error protokol, XML rusak, serta kombinasi argumen yang tidak sah.
- Status HTTP error, kegagalan jaringan, timeout, respons kosong, dan batas ukuran respons.
- State yang hilang atau rusak, cookie kedaluwarsa atau domain lain, izin file, serta penyimpanan sesi atomik.

## Integrasi MCP

`test/server.test.mjs` menghubungkan SDK client dan server melalui `InMemoryTransport`. Tes memeriksa identitas, daftar tool, input schema, respons teks dan terstruktur, penanganan error, dan pemanggilan ketujuh tool.

`test/stdio.test.mjs` menjalankan entry point server sebagai subprocess dari working directory lain. Tes melakukan handshake, daftar tool, pemanggilan `auth_status`, dan penutupan klien. Tes juga memeriksa kegagalan login CLI pada terminal noninteraktif.

`test/cli.test.mjs` memeriksa perintah `mercy` dan format konfigurasi ketiga harness, termasuk path Windows dengan spasi dan perbedaan OpenCode 1.x/V2. `test/browser.test.mjs` memeriksa deteksi browser serta pembuka URL untuk Linux, macOS, dan Windows tanpa menjalankan browser asli.

`test/login.test.mjs` menggunakan browser dan terminal simulasi untuk menguji konfirmasi manual, penyimpanan state, penutupan resource, serta fallback URL ketika peluncuran gagal. `test/install.test.mjs` memverifikasi argumen npm installer pada OS yang sesuai, termasuk prefix dengan spasi. Kasus installer Windows berjalan pada runner Windows; kasus POSIX berjalan pada Linux/macOS.

## Coverage

Ambang minimum di `test:coverage` adalah 95% baris, 85% branch, dan 95% fungsi pada `src/`. Modul CLI, deteksi browser, generator harness, dan alur login termasuk dalam coverage; operasi GUI menggunakan simulasi. Wrapper `bin/` dan installer `scripts/` diuji melalui subprocess dan tidak masuk angka coverage `src/`. Keberhasilan login dengan akun kampus pada browser asli tetap memerlukan pemeriksaan manual.

Jangan menaikkan coverage dengan assertion yang hanya meniru implementasi. Tambahkan kasus perilaku, kegagalan sumber, atau regresi yang dapat diamati pengguna.

## Pengujian live

Tes live menggunakan SDK client melalui transport stdio, tanpa mock HTTP, tanpa kredensial, dan tanpa akses PDF. Pemanggilan dijalankan berurutan agar tidak membanjiri layanan kampus.

```bash
npm run test:live
```

Cakupan live meliputi field dan pencarian enam koleksi, dua jenis detail katalog, pencarian repository, detail hasil pencarian, keenam verb OAI, serta kelanjutan batch melalui `resumptionToken`. Metadata yang dapat berubah diuji melalui bentuk dan invariannya, bukan snapshot judul atau total arsip tertentu.

Kegagalan DNS, downtime, CAPTCHA/challenge sumber, atau perubahan HTML akan menggagalkan tes live. Periksa respons sumber dan bedakan perubahan parser dari gangguan layanan. Tes ini tidak mengonfirmasi keberhasilan login manual atau validitas akun Portal.

## CI GitHub

Workflow `CI` dikonfigurasi berjalan pada push dan pull request dengan Node.js 22 dan 24 di `ubuntu-latest`, `macos-latest`, serta `windows-latest`. Hasil native macOS/Windows baru tersedia setelah workflow dijalankan di GitHub. Workflow `Live upstream tests` dipicu manual melalui `workflow_dispatch` dan membutuhkan akses publik ke layanan kampus. CI tidak membutuhkan secret akun kampus.
