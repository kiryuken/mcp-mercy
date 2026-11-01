# Konfigurasi

## Endpoint

| Sumber                 | Alamat                                             |
| ---------------------- | -------------------------------------------------- |
| Katalog Digilib Meruya | `https://digilib.mercubuana.ac.id/katalog_meruya/` |
| UMB Repository         | `https://repository.mercubuana.ac.id`              |
| Portal                 | `https://portal.mercubuana.ac.id`                  |

Endpoint katalog dan repository ditetapkan di kode. Klien tidak menerima URL arbitrer sebagai parameter tool.

## Environment variable

| Variabel                  | Default                               | Keterangan                                   |
| ------------------------- | ------------------------------------- | -------------------------------------------- |
| `MERCUBUANA_CHROME`       | Deteksi browser sesuai sistem operasi | Path Chrome/Chromium/Edge untuk login manual |
| `MERCUBUANA_STATE_DIR`    | `~/.mcp-mercy`                        | Direktori state default                      |
| `MERCUBUANA_PORTAL_STATE` | `<state dir>/portal-state.json`       | Path file state; prioritas di atas state dir |
| `MERCUBUANA_PORTAL_URL`   | `https://portal.mercubuana.ac.id`     | URL HTTPS yang dibuka utilitas login         |

Nama variabel lama dipertahankan agar konfigurasi lokal tetap dapat digunakan. Tidak ada pemuatan `.env` otomatis; atur environment pada shell atau bagian `env` konfigurasi klien MCP. Gunakan path absolut untuk konfigurasi lintas aplikasi.

Contoh pada shell POSIX:

```bash
MERCUBUANA_CHROME=/usr/bin/google-chrome mercy login
MERCUBUANA_STATE_DIR=/private/path/mercy-state mercy serve
```

Contoh pada PowerShell:

```powershell
$env:MERCUBUANA_CHROME = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
mercy login
```

Browser tidak dipasang otomatis oleh `playwright-core`. Deteksi mencakup Chrome/Chromium pada Linux, aplikasi Chrome/Chromium/Edge pada macOS, serta instalasi Chrome/Edge per pengguna dan sistem pada Windows. Jika tidak terdeteksi, atur `MERCUBUANA_CHROME`. Login yang menyimpan sesi memerlukan terminal interaktif dan desktop grafis.

`mercy login` selalu mencetak URL sebelum mencoba browser. Saat browser sesi tidak dapat dibuka, perintah mencoba pembuka URL bawaan OS dan tetap menyediakan tautan. Login di browser bawaan tidak mengekspor cookie ke MCP; exit code `1` menandakan sesi belum disimpan. `mercy login --url` hanya mencetak tautan tanpa mencoba browser.

Panduan npm, curl, PowerShell, dan pemilihan harness tersedia di [instalasi](installation.md). `npm run login` tetap tersedia untuk penggunaan dari checkout source.

## Migrasi dari struktur lama

Entry point lama `server.mjs` di root diganti dengan `bin/mcp-mercy.mjs`. Perbarui path pada konfigurasi aplikasi MCP dan gunakan nama server `mcp-mercy`.

Sesi lama di `~/.mercubuana-mcp/portal-state.json` tidak dipindahkan otomatis. Pilih salah satu:

1. Jalankan `mercy login` untuk membuat state baru di lokasi default.
2. Atur `MERCUBUANA_PORTAL_STATE` ke path file lama bila ingin tetap menggunakannya.

Penyimpanan sesi tidak dibutuhkan untuk pencarian publik. Cookie tidak dipasang pada HTTP client katalog maupun repository.

## Pemecahan masalah

| Gejala                                            | Tindakan                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Aplikasi tidak menemukan `node`                   | Gunakan path absolut executable Node.js pada `command`                                                 |
| `Periksa jaringan atau DNS`                       | Periksa koneksi dan akses ke domain kampus dari mesin tempat server berjalan                           |
| `HTTP 403` atau halaman pembatasan akses          | Coba kembali setelah layanan mengizinkan akses; periksa langsung dengan browser                        |
| `Form katalog` atau `Tabel hasil` tidak ditemukan | Periksa perubahan HTML sumber dan perbarui parser beserta fixture                                      |
| `Filter katalog tidak dikenal`                    | Panggil `catalog_fields` dan gunakan nama field yang dikembalikan                                      |
| Browser login gagal terbuka                       | Gunakan tautan yang ditampilkan; set `MERCUBUANA_CHROME` dan ulangi `mercy login` untuk menyimpan sesi |
| `loggedIn: null`                                  | State lokal tersedia; login belum diverifikasi ke Portal                                               |
| Tidak ada banner setelah `npm start`              | Server sedang menunggu pesan MCP di stdin                                                              |

Jika sumber lambat, konfigurasikan timeout pemanggilan tool pada klien lebih dari 60 detik. Pencarian katalog menggunakan dua permintaan berurutan, sedangkan satu permintaan OAI dapat menunggu hingga 45 detik.
