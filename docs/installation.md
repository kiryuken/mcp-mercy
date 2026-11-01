# Instalasi dan integrasi harness

Repositori resmi proyek: [kiryuken/mcp-mercy](https://github.com/kiryuken/mcp-mercy). Pilih metode instalasi, lalu konfigurasi OpenCode, Claude Code, atau Codex. Ketiganya memakai server stdio yang sama.

## Status distribusi

Paket [`mcp-mercy` versi `1.0.0`](https://www.npmjs.com/package/mcp-mercy) tersedia di registry npm dengan tag `latest`. Instalasi GitHub/curl memakai branch `main` repositori publik; checkout lokal juga dapat dipakai untuk pengembangan.

## Persyaratan

- Node.js 22.22 atau lebih baru, disarankan Node.js 24, beserta npm dari [nodejs.org](https://nodejs.org/).
- Harness yang sudah terpasang: OpenCode, Claude Code, atau Codex.
- Akses HTTPS ke GitHub/npm saat instalasi dan ke layanan kampus saat pencarian.
- Chrome, Chromium, atau Edge dan desktop grafis untuk login yang menyimpan sesi. Pencarian publik dapat digunakan tanpa login.

Periksa runtime dari terminal yang akan dipakai harness:

```bash
node --version
npm --version
```

## Instalasi dengan npm

### Dari GitHub

Perintah ini berlaku pada terminal Linux, macOS, dan PowerShell Windows. Tidak memerlukan Git terpasang:

```bash
npm install --global https://github.com/kiryuken/mcp-mercy/archive/refs/heads/main.tar.gz
mercy --version
```

### Dari registry npm

```bash
npm install --global mcp-mercy
mercy --help
```

Untuk memilih versi tertentu, gunakan `mcp-mercy@VERSI`, misalnya `mcp-mercy@1.0.0`.

### Dari checkout lokal

```bash
git clone https://github.com/kiryuken/mcp-mercy.git
cd mcp-mercy
npm ci
npm install --global .
mercy --help
```

Jika checkout sudah tersedia, mulai dari `npm ci`. Di Linux/macOS, prefix npm yang tidak dapat ditulis dapat diganti dengan `--prefix "$HOME/.local"` dan menambahkan `$HOME/.local/bin` ke PATH, atau gunakan installer berikut.

## Instalasi dengan curl pada Linux dan macOS

```bash
curl -fsSL https://raw.githubusercontent.com/kiryuken/mcp-mercy/main/scripts/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
mercy --version
```

Installer memakai npm untuk memasang source GitHub ke `~/.local`, memeriksa versi Node.js, dan tidak memakai sudo atau mengubah profil shell. Tambahkan direktori bin tersebut ke PATH shell Anda agar tersedia di terminal baru. Buka ulang aplikasi harness setelah memperbarui PATH.

Untuk mengunduh script sebelum menjalankannya atau memakai prefix khusus:

```bash
curl -fsSL https://raw.githubusercontent.com/kiryuken/mcp-mercy/main/scripts/install.sh -o install-mercy.sh
sh install-mercy.sh --prefix "$HOME/.local"
```

Installer juga menerima paket lokal atau versi npm tertentu:

```bash
sh scripts/install.sh --package /absolute/path/mcp-mercy-1.0.0.tgz --prefix "$HOME/.local"
sh scripts/install.sh --package mcp-mercy@1.0.0 --prefix "$HOME/.local"
```

## Instalasi pada Windows

Metode npm di atas dapat dijalankan langsung dari PowerShell. Alternatif installer PowerShell yang diunduh dengan curl bawaan Windows:

```powershell
$mercyInstaller = Join-Path $env:TEMP 'mcp-mercy-install.ps1'
curl.exe -fsSL https://raw.githubusercontent.com/kiryuken/mcp-mercy/main/scripts/install.ps1 -o $mercyInstaller
if ($LASTEXITCODE -ne 0) { throw 'Unduhan installer gagal.' }
& $mercyInstaller
$env:Path = "$(Join-Path $env:LOCALAPPDATA 'mcp-mercy');$env:Path"
mercy --version
```

Installer memasang paket di `%LOCALAPPDATA%\mcp-mercy`. Penambahan PATH di contoh hanya berlaku pada sesi PowerShell saat ini. Untuk pemakaian di terminal baru atau aplikasi desktop, tambahkan direktori tersebut pada PATH pengguna lewat pengaturan Environment Variables Windows, lalu buka ulang aplikasi.

Prefix atau sumber paket dapat diatur dengan `-Prefix` dan `-Package`. Jika kebijakan eksekusi PowerShell menolak script, gunakan metode npm langsung. Jika hanya shim `mercy.ps1` yang ditolak, gunakan `mercy.cmd`.

Untuk WSL, gunakan metode Linux dan pasang paket dalam environment yang sama dengan harness. Jika WSL tidak memiliki desktop/WSLg, tautan login tetap tersedia; penyimpanan sesi membutuhkan browser yang dapat dijalankan dari environment tersebut.

## Konfigurasi harness

Generator memakai lokasi absolut Node.js dan CLI, termasuk escaping path Windows dengan spasi. Output hanya ditampilkan di terminal. Gabungkan entri `mercy` ke konfigurasi yang sudah ada agar server lain tetap tersedia. Jalankan kembali generator bila lokasi Node.js atau paket berubah.

### OpenCode

Untuk OpenCode 1.x:

```bash
mercy config opencode
```

Gabungkan hasilnya ke `opencode.json`/`opencode.jsonc` proyek, atau konfigurasi global `~/.config/opencode/opencode.json`. Pada Windows, `~` merujuk ke folder pengguna, misalnya `C:\Users\Nama`.

OpenCode 1.x menempatkan server di `mcp.mercy`, memakai `type: "local"`, array `command`, dan `enabled: true`. Contoh statis ada di [examples/opencode.json](../examples/opencode.json). Bentuk konfigurasi mengikuti [dokumentasi MCP OpenCode 1.x](https://opencode.ai/docs/mcp-servers/).

Periksa koneksi:

```bash
opencode mcp list
```

### OpenCode V2

Periksa versi dengan `opencode --version`. Untuk V2 gunakan:

```bash
mercy config opencode --v2
```

V2 memakai `mcp.servers.mercy` serta objek timeout. Contoh ada di [examples/opencode-v2.json](../examples/opencode-v2.json), mengikuti [dokumentasi MCP OpenCode V2](https://opencode.ai/v2/docs/mcp-servers/). Jangan menyalin bentuk 1.x ke V2.

### Claude Code

Pada Linux/macOS dengan `mercy` tersedia di PATH:

```bash
claude mcp add --transport stdio --scope user mercy -- mercy serve
claude mcp list
```

Pada Windows gunakan launcher command processor untuk shim npm:

```powershell
claude mcp add --transport stdio --scope user mercy -- cmd.exe /d /c mercy serve
claude mcp list
```

Untuk konfigurasi yang memakai path absolut tanpa shim, jalankan `mercy config claude`, lalu gabungkan objek `mcpServers.mercy` ke `.mcp.json` proyek. Konfigurasi scope proyek dapat memerlukan persetujuan trust dari Claude Code. Jangan mengganti seluruh konfigurasi pengguna dengan output generator. Scope dan transport mengikuti [panduan MCP Claude Code](https://code.claude.com/docs/en/mcp).

### Codex

Pada Linux/macOS:

```bash
codex mcp add mercy -- mercy serve
codex mcp list
```

Pada Windows dengan shim npm:

```powershell
codex mcp add mercy -- cmd.exe /d /c mercy serve
codex mcp list
```

Alternatif pada semua sistem operasi:

```bash
mercy config codex
```

Gabungkan blok `[mcp_servers.mercy]` ke `~/.codex/config.toml`. Generator menyertakan timeout tool 90 detik dan path absolut. Contoh statis tersedia di [examples/codex.toml](../examples/codex.toml). CLI dan konfigurasi TOML mengikuti [dokumentasi resmi Codex MCP](https://developers.openai.com/codex/mcp).

## Login akun Mercu Buana

```bash
mercy login
```

CLI selalu menampilkan URL `https://portal.mercubuana.ac.id/`, lalu mencoba browser yang didukung. Selesaikan akun dan CAPTCHA di browser secara manual, kembali ke terminal, dan tekan Enter. Jika state Portal aktif berhasil ditangkap, sesi disimpan ke `~/.mcp-mercy/portal-state.json`.

Jika browser gagal terbuka, CLI mencoba pembuka URL bawaan OS dan menyediakan tautan untuk dibuka sendiri. Login lewat browser bawaan atau tautan tidak mengekspor cookie ke MCP. Untuk menyimpan sesi, pasang browser yang didukung, atur path bila perlu, dan ulangi login.

Linux/macOS, bila browser tidak terdeteksi:

```bash
MERCUBUANA_CHROME=/absolute/path/to/chrome mercy login
```

Windows:

```powershell
$env:MERCUBUANA_CHROME = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
mercy login
```

Tampilkan tautan saja atau periksa state lokal:

```bash
mercy login --url
mercy status
```

`mercy status` tidak memverifikasi login ke server Portal. `loggedIn: null` berarti cookie lokal tersedia tetapi login belum diverifikasi. Pencarian publik tidak membutuhkan sesi ini dan login Portal tidak otomatis memberi akses PDF EPrints. `codex mcp login` dan `opencode mcp auth` adalah alur OAuth MCP; gunakan `mercy login` untuk akun Portal proyek ini.

## Pembaruan dan penghapusan

Untuk memperbarui instalasi dari GitHub, ulangi perintah npm atau installer yang sama. Gunakan prefix yang sama dengan instalasi awal. Untuk paket registry, gunakan `npm install --global mcp-mercy@VERSI` atau `npm install --global mcp-mercy@latest`.

Hapus instalasi npm default:

```bash
npm uninstall --global mcp-mercy
```

Untuk installer Linux/macOS gunakan `npm uninstall --global --prefix "$HOME/.local" mcp-mercy`. Untuk installer Windows gunakan `npm uninstall --global --prefix "$env:LOCALAPPDATA\mcp-mercy" mcp-mercy` di PowerShell.

Hapus entri `mercy` dari konfigurasi harness bila tidak dipakai lagi. Penghapusan paket tidak menghapus state Portal; hapus file state secara terpisah bila ingin mengakhiri penyimpanannya.

## Pemecahan masalah

| Gejala                                      | Tindakan                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Unduhan GitHub 404                          | Pastikan repositori publik dan branch `main` sudah dipush                                                    |
| npm registry mengembalikan 404              | Periksa ejaan nama, versi yang diminta, dan registry; paket publik menggunakan `https://registry.npmjs.org/` |
| `mercy` tidak ditemukan                     | Periksa prefix dan PATH, buka ulang terminal/harness, atau gunakan path absolut hasil generator              |
| Shim PowerShell ditolak                     | Gunakan `mercy.cmd` dan metode npm langsung                                                                  |
| Browser tidak terbuka                       | Pakai tautan yang tercetak; set `MERCUBUANA_CHROME` untuk penyimpanan sesi                                   |
| Server terbuka tetapi tidak mencetak output | `mercy serve` sedang menunggu pesan MCP dari harness                                                         |
| OpenCode menolak konfigurasi                | Sesuaikan generator 1.x atau `--v2` dengan versi yang terpasang                                              |
