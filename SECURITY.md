# Keamanan

## Batas akses

Server hanya membaca halaman katalog, metadata repository, dan endpoint OAI-PMH publik. Server menggunakan stdio tanpa membuka port HTTP lokal. Tidak ada fungsi untuk mengunduh PDF, mengubah data kampus, melewati CAPTCHA, atau memakai sesi Portal untuk mengakses EPrints.

Permintaan HTTP memiliki timeout 30 detik; OAI-PMH memiliki timeout 45 detik. Ukuran respons dibatasi 8 MiB. Parser menolak tautan selain HTTP/HTTPS pada hasil, action form di luar direktori katalog, XML tidak valid, serta deklarasi DTD/entity.

## Sesi lokal

`mercy login` (atau `npm run login` dari source) membuka browser untuk login manual. Proyek tidak membaca input password, tetapi state browser yang disimpan dapat berisi cookie autentikasi dan local storage. State tersebut tetap merupakan data sensitif.

Jika browser yang didukung gagal dibuka, CLI menyediakan URL dan mencoba browser bawaan OS tanpa shell. Mode fallback tidak mengambil cookie dari browser bawaan dan tidak menganggap sesi MCP telah tersimpan. `mercy config` hanya mencetak konfigurasi harness, tanpa menulis file pengguna atau menyertakan cookie.

State disimpan melalui file sementara dengan izin `0600`, lalu dipindahkan secara atomik ke tujuan. Direktori baru dibuat dengan mode `0700`. Izin ini berlaku pada sistem POSIX; sistem lain perlu memakai kontrol akses setempat.

`auth_status` hanya membaca file lokal. Pemeriksaan mengabaikan cookie yang kedaluwarsa atau tidak berlaku untuk domain Portal, tidak menampilkan nilai cookie, dan tidak menganggap keberadaan cookie sebagai bukti login yang sudah diverifikasi.

## File yang dikecualikan dari Git

`.gitignore` mengecualikan state browser, ekspor cookie, HAR/trace, direktori autentikasi Playwright, `.env`, konfigurasi registry dan cloud lokal, private key, arsip, serta file sementara. `.env.example` tetap dapat disertakan sebagai template tanpa kredensial.

Path state khusus melalui `MERCUBUANA_PORTAL_STATE` sebaiknya berada di luar checkout. Nama file khusus yang tidak cocok dengan pola ignore perlu ditambahkan ke `.gitignore`. Aturan ignore tidak menghapus file yang sudah dilacak atau tersimpan dalam riwayat commit; periksa perubahan yang akan di-commit sebelum publikasi.

## Melaporkan masalah

Jika GitHub Private Vulnerability Reporting tersedia pada repositori, gunakan kanal tersebut. Jika belum tersedia, hubungi pemelihara melalui kontak privat pada profil GitHub. Hindari menulis kredensial, cookie, state browser, atau contoh eksploitasi yang mengungkap data pribadi di issue publik.

Sertakan versi Node.js, versi paket, langkah reproduksi tanpa data sensitif, dan dampak yang teramati. Audit dependensi dapat dijalankan dengan `npm audit`; hasil audit menggambarkan advisori yang tersedia pada saat pemeriksaan.
