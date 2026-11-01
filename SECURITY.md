# Keamanan

## Batas akses

Server membaca halaman katalog, metadata repository, endpoint OAI-PMH, dan teks PDF yang dapat diakses publik. Server menggunakan stdio tanpa membuka port HTTP lokal. Tool `pdf_read` tidak mengirim cookie Portal, mengubah data kampus, melewati CAPTCHA, atau membuka PDF berpassword.

Permintaan HTTP memiliki timeout 30 detik; OAI-PMH memiliki timeout 45 detik. Ukuran respons dibatasi 8 MiB. Parser menolak tautan selain HTTP/HTTPS pada hasil, action form di luar direktori katalog, XML tidak valid, serta deklarasi DTD/entity.

## Pembacaan PDF publik

`pdf_read` hanya menerima HTTPS pada dua host tepat: `repository.mercubuana.ac.id` dan `digilib.mercubuana.ac.id`. Kredensial URL, port khusus, host eksternal, dan alamat lokal ditolak. Setiap tujuan redirect diperiksa kembali; maksimal tiga redirect diikuti. Respons 401/403, halaman HTML/login, dan file melebihi 20 MiB tidak diproses.

PDF diekstrak menggunakan PDF.js dalam worker terpisah, dengan batas dua worker bersamaan, heap 256 MiB, dan deadline ekstraksi 20 detik. Unduhan memiliki deadline 30 detik untuk seluruh rangkaian redirect. Evaluasi JavaScript dan pengambilan resource font melalui jaringan dinonaktifkan. Output worker tidak diteruskan ke stdout protokol MCP.

Dokumen diproses di memori tanpa cache file. Teks dokumen harus diperlakukan sebagai data sumber. Ekstraksi tidak menjalankan OCR atau memberikan bukti bahwa tata letak tabel, rumus, serta urutan kolom identik dengan tampilan asli.

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
