# Kontribusi

## Menyiapkan lingkungan

Gunakan Node.js yang memenuhi `engines` di `package.json`. Versi pengembangan disediakan di `.nvmrc`.

```bash
nvm use
npm ci
npm run check
```

`nvm` bersifat opsional. Node.js dapat dipasang dengan pengelola versi lain.

## Pembagian modul

| Lokasi                                      | Tanggung jawab                                            |
| ------------------------------------------- | --------------------------------------------------------- |
| `bin/mcp-mercy.mjs`                         | Menghubungkan server ke transport stdio                   |
| `bin/mercy.mjs`                             | Entry point perintah `mercy`                              |
| `bin/login.mjs`                             | Menjaga kompatibilitas `npm run login`                    |
| `src/cli.mjs`                               | Menangani serve, login, status, dan konfigurasi harness   |
| `src/login.mjs`                             | Menjalankan login browser manual dan fallback tautan      |
| `src/browser.mjs`                           | Mendeteksi browser dan membuka URL sesuai sistem operasi  |
| `src/harness.mjs`                           | Menghasilkan konfigurasi OpenCode, Claude Code, dan Codex |
| `scripts/install.sh`, `scripts/install.ps1` | Installer POSIX dan Windows                               |
| `src/server.mjs`                            | Mendaftarkan tool dan membentuk respons MCP               |
| `src/schemas.mjs`                           | Memvalidasi parameter dan kombinasi argumen OAI           |
| `src/catalog.mjs`                           | Membaca form, hasil pencarian, dan detail katalog         |
| `src/repository.mjs`                        | Membaca metadata dan label dokumen EPrints                |
| `src/oai.mjs`                               | Membaca XML OAI-PMH dan token batch                       |
| `src/http.mjs`                              | Menangani HTTP, timeout, dan batas ukuran respons         |
| `src/auth.mjs`                              | Memeriksa dan menyimpan state Portal lokal                |
| `src/config.mjs`                            | Menyediakan endpoint dan konfigurasi sesi                 |
| `src/html.mjs`                              | Menormalkan teks dan tautan hasil parser                  |

## Perubahan kode

Gunakan ES modules dan gaya format Prettier yang disediakan proyek. Saat memperbaiki parser, tambahkan fixture sintetis yang mewakili struktur sumber serta assertion untuk perilaku yang berubah. Jangan memasukkan respons berisi data sesi, cookie, akun pribadi, atau materi akses terbatas.

Semua output stdout server harus berupa pesan MCP. Gunakan stderr jika perlu melaporkan kegagalan startup. Panggilan tool harus mengembalikan `isError: true` untuk kegagalan yang dapat ditindaklanjuti oleh klien.

Jalankan pemeriksaan sebelum mengirim perubahan:

```bash
npm run format
npm run check
npm run test:coverage
npm audit --audit-level=moderate
npm pack --dry-run
```

Jalankan `npm run test:live` jika mengubah struktur permintaan atau asumsi terhadap sumber kampus. Uji live tidak menggunakan akun dan tidak mengunduh PDF. Login browser interaktif perlu diperiksa manual bila alurnya berubah.

Dependensi `minimatch` di-override ke versi 11.0.1 atau lebih baru untuk menutup [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) pada rantai tooling ESLint. Evaluasi kembali override setelah upstream memakai versi yang sudah ditambal.

## Pull request

Jelaskan masalah, perubahan perilaku, dan hasil verifikasi. Perbarui dokumentasi ketika nama parameter, respons, persyaratan runtime, atau konfigurasi berubah. Catat perubahan pengguna di bagian `Unreleased` pada changelog.

## Push pertama ke GitHub

Untuk folder proyek yang belum memiliki riwayat Git, jalankan dari root proyek setelah menyiapkan repositori kosong `kiryuken/mcp-mercy`.

```bash
git init -b main
git add .
git status --short
git commit -m "Prepare mcp-mercy for release"
git remote add origin https://github.com/kiryuken/mcp-mercy.git
git push -u origin main
```

Periksa daftar file sebelum commit. `node_modules`, file sesi, konfigurasi lokal, dan `.env` sudah dikecualikan melalui `.gitignore`. Nama direktori checkout boleh berbeda dari nama repositori; identitas paket dan server tetap `mcp-mercy`.
