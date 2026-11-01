# Changelog

## Unreleased

### Ditambahkan

- Tool `pdf_read` untuk membaca PDF publik Mercu Buana dengan teks per halaman, citation, SHA-256, dan kelanjutan teks tanpa melewati sisa halaman.
- Batas unduhan 20 MiB, validasi setiap redirect, timeout, serta worker ekstraksi dengan batas memori dan konkurensi.
- Pengujian PDF sintetis, penolakan file rusak/berpassword, kontrak MCP, dan PDF publik pada suite live.

### Diubah

- Versi source disiapkan menjadi `1.1.0`; rilis npm `1.0.0` tetap tersedia sampai pembaruan diterbitkan.
- Metadata `repository_item` mengarahkan pembacaan file publik ke `pdf_read`.

### Dokumentasi

- Perbarui status distribusi dan panduan instalasi setelah `mcp-mercy@1.0.0` tersedia di npm.

## 1.0.0 - 2026-11-02

### Ditambahkan

- CLI `mercy` dengan `serve`, `login`, `login --url`, `status`, dan generator konfigurasi harness.
- Installer curl/POSIX dan PowerShell tanpa perubahan profil shell otomatis.
- Panduan instalasi npm/GitHub untuk OpenCode 1.x/V2, Claude Code, dan Codex.
- Deteksi browser pada Linux, macOS, dan Windows serta tautan fallback login.
- Pengujian unit dengan fixture sintetis, integrasi MCP, dan CLI stdio.
- Pengujian live untuk enam koleksi katalog dan seluruh operasi OAI-PMH.
- Pemeriksaan ESLint, Prettier, serta ambang coverage untuk modul `src/`.
- GitHub Actions untuk Node.js 22 dan 24 di Linux, macOS, dan Windows serta workflow live manual.
- Dokumentasi konfigurasi, kontrak tool, pengujian, keamanan, dan kontribusi.

### Diubah

- Nama paket, binary, dan identitas server menjadi `mcp-mercy`.
- Implementasi dipisahkan ke `src/`, entry point ke `bin/`, dan tes ke `test/`.
- Lokasi sesi default menjadi `~/.mcp-mercy/portal-state.json`; variabel `MERCUBUANA_*` tetap didukung.
- Pencarian katalog mengikuti action, metode, dan nilai awal form sumber.
- Respons tool menyediakan JSON teks dan `structuredContent` dengan data yang sama.
- `auth_status` menyediakan `hasSession` serta `verified`; `loggedIn` bernilai `null` ketika sesi lokal tersedia tetapi belum diverifikasi.
- Batas output OAI dapat dinaikkan sampai 500 record agar batch sumber dapat diperiksa lebih lengkap.

### Diperbaiki

- Pembatasan satu file tidak lagi menandai seluruh file repository sebagai restricted.
- ID numerik dengan nol di depan tetap dipertahankan pada metadata XML.
- Argumen OAI yang tidak sesuai verb dan kombinasi token yang tidak valid ditolak sebelum HTTP.
- Error HTTP, timeout, halaman pembatasan, dan perubahan struktur sumber dilaporkan dengan jelas.
- State sesi ditulis secara atomik dengan izin file privat, termasuk saat mengganti file lama.
- Metadata paket, entry point, lockfile, dan pengecualian file sensitif diselaraskan.
- Pengecualian Git diperluas untuk cookie, state browser, trace, private key, konfigurasi kredensial, serta arsip lokal.
