# Referensi tool

## Konvensi respons

Hasil sukses berisi JSON pada `content[0].text` serta objek yang sama pada `structuredContent`. Kegagalan validasi atau permintaan menghasilkan `isError: true`. Error protokol OAI tetap menyertakan struktur `error` agar kode sumber dapat diperiksa.

ID record diberikan sebagai string numerik agar nol di depan tetap utuh. Halaman dan file sumber diperlakukan sebagai data; tautan yang dikembalikan tidak dieksekusi atau diunduh.

## `catalog_fields`

| Parameter    | Tipe   | Ketentuan                                                              |
| ------------ | ------ | ---------------------------------------------------------------------- |
| `collection` | string | `jurnal`, `tugas_akhir`, `buku`, `penelitian`, `artikel`, atau `ebook` |

Mengembalikan `collection`, `label`, `page`, `method`, `fields`, dan `hidden`. Setiap field memiliki `name`, `type`, dan `default`; select juga memiliki `options`.

## `catalog_search`

| Parameter    | Tipe                   | Default | Ketentuan                                                           |
| ------------ | ---------------------- | ------- | ------------------------------------------------------------------- |
| `collection` | string                 | Wajib   | Salah satu koleksi katalog                                          |
| `filters`    | objek string ke string | `{}`    | Nama field dari `catalog_fields`; maksimum 2.000 karakter per nilai |
| `limit`      | integer                | `50`    | `1` sampai `100`                                                    |

Server membaca form, mengikuti action dan metode GET/POST, mempertahankan nilai awal, lalu menerapkan filter. Action harus tetap berada di direktori katalog pada origin yang sama. Filter yang tidak dikenal ditolak sebelum form dikirim.

`count` adalah jumlah baris yang dibaca dari respons sumber saat ini, bukan total seluruh katalog. `returned` adalah jumlah baris setelah limit lokal. `truncated` menandakan baris respons dipotong. `rows` memakai label kolom sumber sebagai key, ditambah `links` dan `detail_url` bila tersedia. Tool ini tidak menelusuri halaman katalog selanjutnya secara otomatis.

## `catalog_item`

| Parameter    | Tipe   | Ketentuan                 |
| ------------ | ------ | ------------------------- |
| `collection` | string | `tugas_akhir` atau `buku` |
| `id`         | string | `1` sampai `30` digit     |

Mengembalikan `id`, `url`, dan `fields` berisi pasangan `label`/`value`. Jika halaman tidak menyediakan field detail, `fields` kosong dan `text` berisi ringkasan teks maksimal 3.000 karakter. `note` menjelaskan penggunaan hasil pencarian sebagai alternatif.

## `repository_search`

| Parameter | Tipe    | Default | Ketentuan                                     |
| --------- | ------- | ------- | --------------------------------------------- |
| `query`   | string  | Wajib   | Setelah trim, `1` sampai `2.000` karakter     |
| `page`    | integer | `0`     | `0` sampai `500`                              |
| `limit`   | integer | `20`    | `1` sampai `50`; hanya membatasi output lokal |

`page` memakai offset `page * 20` sesuai pagination sumber. Meminta `limit: 50` tidak memicu pengambilan beberapa halaman; sumber biasanya menyediakan 20 hasil per halaman.

Hasil menyertakan `total` dari halaman sumber, `count` yang ditampilkan, `parsedCount`, `truncated`, `pageSize`, `source`, dan `items`. Setiap item menyediakan ID, judul, penulis pertama yang ditampilkan, tahun, jenis, URL, daftar tautan PDF, serta `restricted`. Gunakan `repository_item` untuk daftar penulis dan label dokumen yang lebih lengkap.

## `repository_item`

| Parameter  | Tipe   | Ketentuan             |
| ---------- | ------ | --------------------- |
| `eprintId` | string | `1` sampai `30` digit |

Mengembalikan metadata EPrints: judul, abstrak, penulis, tanggal, jenis, divisi, institusi, `fullTextStatus`, dan `files`. Tautan duplikat digabung. Pembatasan dinilai per baris dokumen, sehingga bab restricted tidak mengubah status cover.

`files[].restricted` bernilai `true` ketika label pembatasan ditemukan atau `null` ketika akses belum diverifikasi. `repository_item` tidak mengirim permintaan HEAD/GET ke PDF; gunakan `pdf_read` untuk mengambil teks dokumen publik melalui permintaan terpisah.

## `pdf_read`

| Parameter    | Tipe    | Default | Ketentuan                                                                                             |
| ------------ | ------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `url`        | string  | Wajib   | URL HTTPS pada `repository.mercubuana.ac.id` atau `digilib.mercubuana.ac.id`; maksimal 4.096 karakter |
| `page`       | integer | `1`     | Halaman fisik mulai dari 1; maksimal 100.000 dan harus tersedia pada PDF                              |
| `pageOffset` | integer | `0`     | Posisi awal pada teks halaman; gunakan nilai dari `next`                                              |
| `maxPages`   | integer | `5`     | `1` sampai `20` halaman per respons                                                                   |
| `maxChars`   | integer | `20000` | `1` sampai `80000` karakter teks per respons                                                          |

Gunakan URL file dari `repository_item` atau tautan katalog yang dapat diakses publik. File maksimal 20 MiB diproses di memori melalui PDF.js. Redirect hanya diikuti bila tujuannya tetap memenuhi batas host dan HTTPS. Tool tidak mengirim cookie, mengeksekusi JavaScript PDF, menerima password, atau mengakses path lokal.

Hasil menyediakan `source`, URL final `url`, `bytes`, `sha256`, `pageCount`, `returnedPages`, `chars`, `pages`, `next`, dan `truncated`. Setiap halaman berisi:

| Field           | Makna                                        |
| --------------- | -------------------------------------------- |
| `number`        | Nomor halaman fisik PDF, mulai dari 1        |
| `offset`        | Posisi awal potongan pada teks halaman       |
| `text`          | Teks yang tersedia pada respons ini          |
| `textLength`    | Panjang seluruh teks hasil ekstraksi halaman |
| `hasMoreText`   | Masih ada teks pada halaman yang sama        |
| `textAvailable` | Halaman memiliki teks yang dapat diekstrak   |
| `citation`      | URL dokumen dengan anchor `#page=N`          |

Jika `next` tidak `null`, teruskan dengan URL yang sama serta `page` dan `pageOffset` dari objek tersebut. Offset dapat berada di tengah halaman ketika `maxChars` tercapai. `truncated: true` menandakan masih ada teks atau halaman; bukan alasan untuk menyimpulkan bahwa seluruh dokumen sudah dibaca.

```text
pdf_read(url="https://repository.mercubuana.ac.id/104728/1/Cover.pdf", page=1, maxPages=3)
pdf_read(url="URL_YANG_SAMA", page=NEXT_PAGE, pageOffset=NEXT_OFFSET)
```

Nomor halaman bukan nomor cetak bab atau angka Romawi pada halaman. SHA-256 dapat dibandingkan antar pemanggilan untuk memeriksa konsistensi dokumen. Halaman scan, gambar, atau kosong dapat menghasilkan `textAvailable: false`; tool tidak menjalankan OCR. Urutan kolom, tabel, dan rumus dapat memerlukan pemeriksaan pada PDF asli.

HTTP 401/403, URL di luar host yang didukung, respons non-PDF, file rusak/berpassword, page/offset di luar dokumen, serta batas unduhan atau pemrosesan menghasilkan `isError: true`.

## `repository_oai`

| Parameter         | Tipe    | Ketentuan                                                           |
| ----------------- | ------- | ------------------------------------------------------------------- |
| `verb`            | string  | Salah satu operasi pada tabel berikut                               |
| `metadataPrefix`  | string  | Contoh: `oai_dc`                                                    |
| `identifier`      | string  | Identifier OAI lengkap                                              |
| `set`             | string  | Nama set dari `ListSets`                                            |
| `from`, `until`   | string  | `YYYY-MM-DD` atau UTC `YYYY-MM-DDTHH:mm:ssZ`                        |
| `resumptionToken` | string  | Token utuh dari respons sebelumnya                                  |
| `limit`           | integer | Default `10`, rentang `1` sampai `500`, tidak dikirim ke server OAI |

| Verb                  | Parameter OAI yang didukung                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `Identify`            | Tidak ada                                                               |
| `ListSets`            | `resumptionToken` opsional                                              |
| `ListMetadataFormats` | `identifier` opsional                                                   |
| `ListRecords`         | `metadataPrefix` wajib, `set`/`from`/`until` opsional; atau hanya token |
| `ListIdentifiers`     | Sama dengan `ListRecords`                                               |
| `GetRecord`           | `metadataPrefix` dan `identifier` wajib                                 |

`resumptionToken` tidak boleh digabung dengan argumen OAI lain selain `verb`. `limit` tetap dapat dipakai karena hanya mengatur output lokal. Rentang tanggal harus berurutan dan menggunakan presisi yang sama, sesuai [spesifikasi OAI-PMH](https://www.openarchives.org/OAI/openarchivesprotocol.html).

Hasil berisi `records`, `count`, `parsedCount`, `truncated`, `resumptionToken`, `identify`, dan `error`. Nilai XML tetap berupa string untuk mempertahankan identifier numerik. Namespace prefix dinormalisasi; metadata Dublin Core berada di `record.metadata.dc`.

Jika `truncated` bernilai `true`, token berikutnya melewati seluruh batch sumber, termasuk record yang tidak ditampilkan oleh limit lokal. Ulangi permintaan batch yang sama dengan limit lebih besar sebelum melanjutkan bila semua record diperlukan. Batas 500 tetap berlaku; tool ini ditujukan untuk penelusuran, bukan harvesting arsip penuh.

Contoh melanjutkan batch:

```text
repository_oai(verb="ListRecords", metadataPrefix="oai_dc", limit=100)
repository_oai(verb="ListRecords", resumptionToken="TOKEN_DARI_RESPONS", limit=100)
```

## `auth_status`

Tidak menerima parameter. Membaca state dari konfigurasi environment.

| Field                    | Makna                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `hasSession`             | Ada cookie Portal lokal yang belum kedaluwarsa atau merupakan session cookie           |
| `loggedIn`               | `false` jika tidak ada sesi; `null` jika sesi tersedia tetapi belum diverifikasi       |
| `verified`               | Selalu `false`, karena tool tidak menghubungi Portal                                   |
| `cookieCount`, `domains` | Jumlah dan domain cookie Portal aktif tanpa nilainya; tersedia bila state dapat dibaca |
| `stateFile`, `updatedAt` | Lokasi dan waktu perubahan file lokal                                                  |
| `note` atau `error`      | Penjelasan status atau masalah pembacaan state                                         |
