# Requirements Document

## Introduction

Fitur **Carrier Workflow** adalah sistem alur kerja jasa angkut barang lokal di platform CampusRelove — marketplace thrifting mahasiswa. Fitur ini memungkinkan pembeli menambahkan opsi jasa angkut saat checkout, carrier (role baru) mengambil dan mengeksekusi tugas pengiriman, serta admin memvalidasi dan mencairkan komisi. Seluruh data disimulasikan menggunakan localStorage sebagai pengganti backend, konsisten dengan arsitektur frontend-only yang sudah ada (React + Vite, React Router, CSS Modules).

Fitur ini memperkenalkan role baru `carrier` ke dalam sistem AuthContext yang sudah ada, serta CarrierContext baru yang mengelola pool pesanan jasa, status pengiriman, komunikasi, dan pencairan dana.

---

## Glossary

- **Carrier**: Pengguna dengan role `carrier` — mahasiswa yang menawarkan jasa angkut barang.
- **Buyer**: Pengguna dengan role `buyer` — pembeli yang memesan barang dan memilih opsi jasa angkut.
- **Seller**: Pengguna dengan role `seller` — penjual barang di CampusRelove.
- **Admin**: Pengguna dengan role `admin` — pengelola platform yang memvalidasi dan mencairkan dana.
- **Carry_Order**: Entitas pesanan jasa angkut yang terpisah dari order produk biasa, disimpan di localStorage dengan key `cr_carry_orders`.
- **Order_Pool**: Kumpulan Carry_Order berstatus `available` yang dapat dilihat dan diambil oleh Carrier.
- **Carrier_Dashboard**: Halaman antarmuka khusus Carrier untuk melihat Order_Pool dan tugas aktif.
- **Claim_System**: Mekanisme "siapa cepat dia dapat" di mana Carrier mengklaim Carry_Order dari Order_Pool.
- **Delivery_Status**: Status progres pengiriman: `available` → `claimed` → `heading_to_seller` → `loading` → `in_transit` → `arrived` → `completed` → `cancelled`.
- **E-Wallet**: Saldo digital Carrier yang tersimpan di field `balance` pada data user di localStorage (`cr_users`).
- **Admin_Fee**: Potongan biaya platform yang dikenakan sebelum komisi dikirim ke E-Wallet Carrier.
- **Proof_Photo**: Foto bukti pengiriman yang diupload Carrier saat barang tiba, disimulasikan sebagai URL base64 atau URL string di localStorage.
- **Pickup_Point**: Alamat/lokasi penjemput barang (lokasi Seller).
- **Dropoff_Point**: Alamat/lokasi tujuan pengiriman (lokasi Buyer).
- **CarrierContext**: React Context baru yang mengelola semua state dan aksi terkait Carry_Order.
- **WhatsApp_Link**: URL `https://wa.me/{nomor}` yang dibuka di tab baru untuk komunikasi langsung.
- **Maps_Link**: URL Google Maps dengan koordinat atau alamat Pickup_Point / Dropoff_Point.

---

## Requirements

### Requirement 1: Registrasi dan Autentikasi Carrier

**User Story:** Sebagai mahasiswa yang ingin menjadi jasa angkut, saya ingin mendaftar sebagai Carrier, agar saya bisa menerima dan mengeksekusi tugas pengiriman di CampusRelove.

#### Acceptance Criteria

1. THE AuthContext SHALL mendukung role `carrier` sebagai nilai valid pada field `role` saat registrasi, selain `buyer` dan `seller` yang sudah ada.
2. WHEN seorang pengguna mendaftar dengan role `carrier`, THE AuthContext SHALL menyimpan data Carrier ke localStorage `cr_users` dengan field tambahan: `vehicleType` (string), `serviceArea` (string), `whatsappNumber` (string), dan `isCarrierVerified` (boolean, default `false`).
3. WHEN seorang Carrier berhasil login, THE System SHALL mengarahkan Carrier ke halaman Carrier_Dashboard (`/carrier/dashboard`).
4. IF seorang pengguna dengan role selain `carrier` mencoba mengakses rute `/carrier/*`, THEN THE System SHALL mengarahkan pengguna tersebut ke halaman utama (`/`).
5. THE AuthContext SHALL menyimpan field `balance` (number, default `0`) pada data Carrier untuk mendukung E-Wallet.

---

### Requirement 2: Inisiasi Pesanan Jasa Angkut (Checkout)

**User Story:** Sebagai Buyer, saya ingin menambahkan opsi jasa angkut saat checkout, agar barang yang saya beli bisa diantarkan langsung ke lokasi saya.

#### Acceptance Criteria

1. WHEN Buyer berada di halaman checkout dan memilih opsi "Tambah Jasa Angkut", THE Checkout_Page SHALL menampilkan form input dengan field: `pickupPoint` (alamat Seller), `dropoffPoint` (alamat Buyer), `itemDescription` (deskripsi barang: contoh "Lemari kecil", "Kursi", "5 Kardus"), `scheduledDate` (tanggal pengambilan), dan `scheduledTime` (jam pengambilan).
2. WHEN Buyer mengkonfirmasi checkout dengan opsi jasa angkut, THE CarrierContext SHALL membuat Carry_Order baru dengan status `available` dan menyimpannya ke localStorage `cr_carry_orders`.
3. THE CarrierContext SHALL menyertakan field berikut pada setiap Carry_Order yang dibuat: `carryOrderId` (string unik), `orderId` (referensi ke order produk terkait), `buyerId`, `buyerName`, `buyerWhatsapp`, `sellerId`, `sellerName`, `sellerWhatsapp`, `pickupPoint`, `dropoffPoint`, `itemDescription`, `scheduledDate`, `scheduledTime`, `estimatedFee` (number), `adminFeePercent` (number, default `10`), `status` (string), `carrierId` (null saat dibuat), `carrierName` (null saat dibuat), `claimedAt` (null), `proofPhotoUrl` (null), `carrierRating` (null), `createdAt` (ISO string).
4. WHEN Carry_Order berhasil dibuat, THE CarrierContext SHALL mengirim notifikasi ke semua Carrier yang terdaftar dengan pesan bahwa ada tugas baru tersedia.
5. IF Buyer tidak mengisi salah satu field wajib pada form jasa angkut (`pickupPoint`, `dropoffPoint`, `itemDescription`, `scheduledDate`, `scheduledTime`), THEN THE Checkout_Page SHALL menampilkan pesan error per field dan mencegah pengiriman form.

---

### Requirement 3: Manajemen Order Pool dan Claim System

**User Story:** Sebagai Carrier, saya ingin melihat daftar pesanan jasa yang tersedia dan mengambil tugas yang sesuai jadwal saya, agar saya bisa mendapatkan penghasilan dari jasa angkut.

#### Acceptance Criteria

1. WHILE Carrier sedang login dan berada di Carrier_Dashboard, THE Carrier_Dashboard SHALL menampilkan semua Carry_Order berstatus `available` dari localStorage `cr_carry_orders` sebagai Order_Pool.
2. THE Carrier_Dashboard SHALL menampilkan detail setiap Carry_Order di Order_Pool, mencakup: nama Buyer, nama Seller, Pickup_Point, Dropoff_Point, deskripsi barang, tanggal dan jam pengambilan, serta estimasi biaya.
3. WHEN Carrier mengklik tombol "Ambil Tugas" pada sebuah Carry_Order, THE CarrierContext SHALL mengubah status Carry_Order tersebut menjadi `claimed`, mengisi field `carrierId`, `carrierName`, dan `claimedAt` dengan data Carrier yang sedang login.
4. WHEN status Carry_Order berubah menjadi `claimed`, THE CarrierContext SHALL mengubah tampilan status di sisi Buyer menjadi "Driver Ditemukan" dan mengirim notifikasi ke Buyer.
5. WHEN status Carry_Order berubah menjadi `claimed`, THE CarrierContext SHALL mengirim notifikasi ke Seller bahwa Carrier sudah ditemukan dan akan menjemput barang.
6. IF sebuah Carry_Order sudah diklaim oleh Carrier lain (status bukan `available`), THEN THE Carrier_Dashboard SHALL tidak menampilkan tombol "Ambil Tugas" untuk Carry_Order tersebut dan menampilkan label "Sudah Diambil".
7. THE Carrier_Dashboard SHALL memisahkan tampilan antara Order_Pool (tugas tersedia) dan "Tugas Aktif Saya" (Carry_Order yang sudah diklaim oleh Carrier yang sedang login).

---

### Requirement 4: Aktivasi Komunikasi Pasca-Klaim

**User Story:** Sebagai Carrier, saya ingin bisa menghubungi Buyer dan Seller setelah mengambil tugas, agar saya bisa berkoordinasi soal lokasi dan waktu penjemputan.

#### Acceptance Criteria

1. WHILE status Carry_Order adalah `claimed` atau lebih lanjut, THE Carrier_Dashboard SHALL menampilkan tombol "Chat via WhatsApp" untuk menghubungi Buyer dan Seller.
2. WHEN Carrier mengklik tombol "Chat via WhatsApp" untuk Buyer, THE System SHALL membuka WhatsApp_Link (`https://wa.me/{buyerWhatsapp}`) di tab baru.
3. WHEN Carrier mengklik tombol "Chat via WhatsApp" untuk Seller, THE System SHALL membuka WhatsApp_Link (`https://wa.me/{sellerWhatsapp}`) di tab baru.
4. WHILE status Carry_Order adalah `claimed` atau lebih lanjut, THE Carrier_Dashboard SHALL menampilkan Maps_Link untuk Pickup_Point dan Dropoff_Point sebagai tautan yang dapat diklik.
5. WHEN Carrier mengklik Maps_Link, THE System SHALL membuka Google Maps dengan alamat Pickup_Point atau Dropoff_Point di tab baru menggunakan URL format `https://www.google.com/maps/search/?api=1&query={encodedAddress}`.
6. IF status Carry_Order adalah `available` (belum diklaim), THEN THE System SHALL tidak menampilkan informasi kontak Buyer, Seller, maupun Maps_Link kepada Carrier manapun, untuk menjaga privasi.

---

### Requirement 5: Pelacakan Status Pengiriman Real-Time

**User Story:** Sebagai Carrier, saya ingin memperbarui status pengiriman secara manual, agar Buyer dan Seller dapat memantau progres pengiriman barang mereka.

#### Acceptance Criteria

1. WHILE Carry_Order berstatus `claimed`, THE Carrier_Dashboard SHALL menampilkan tombol "Mulai Perjalanan ke Penjual" untuk mengubah status menjadi `heading_to_seller`.
2. WHILE Carry_Order berstatus `heading_to_seller`, THE Carrier_Dashboard SHALL menampilkan tombol "Mulai Muat Barang" untuk mengubah status menjadi `loading`.
3. WHILE Carry_Order berstatus `loading`, THE Carrier_Dashboard SHALL menampilkan tombol "Mulai Antar ke Pembeli" untuk mengubah status menjadi `in_transit`.
4. WHILE Carry_Order berstatus `in_transit`, THE Carrier_Dashboard SHALL menampilkan tombol "Tiba di Tujuan" untuk mengubah status menjadi `arrived`.
5. WHEN Carrier memperbarui status Carry_Order ke status apapun, THE CarrierContext SHALL menyimpan perubahan status ke localStorage `cr_carry_orders` dan mengirim notifikasi ke Buyer dengan pesan status terkini.
6. WHEN Carrier memperbarui status Carry_Order ke status apapun, THE CarrierContext SHALL mengirim notifikasi ke Seller dengan pesan status terkini.
7. THE Buyer_Order_Page SHALL menampilkan status Carry_Order terkini dengan label yang sesuai: "Driver Ditemukan" (`claimed`), "Menuju Penjual" (`heading_to_seller`), "Proses Muat Barang" (`loading`), "Sedang Diantar" (`in_transit`), "Tiba di Tujuan" (`arrived`).

---

### Requirement 6: Penyelesaian Pengiriman dan Upload Bukti

**User Story:** Sebagai Carrier, saya ingin mengupload foto bukti pengiriman saat barang sudah tiba, agar ada dokumentasi sah bahwa tugas telah selesai dilaksanakan.

#### Acceptance Criteria

1. WHILE Carry_Order berstatus `arrived`, THE Carrier_Dashboard SHALL menampilkan form upload foto bukti pengiriman.
2. WHEN Carrier mengupload foto bukti, THE CarrierContext SHALL menyimpan foto sebagai data URL (base64) ke field `proofPhotoUrl` pada Carry_Order di localStorage `cr_carry_orders`.
3. IF Carrier mencoba menyelesaikan tugas tanpa mengupload foto bukti, THEN THE Carrier_Dashboard SHALL menampilkan pesan error dan mencegah penyelesaian tugas.
4. WHEN foto bukti berhasil diupload, THE CarrierContext SHALL mengirim notifikasi ke Buyer bahwa barang sudah tiba dan meminta konfirmasi penerimaan.
5. THE Buyer_Order_Page SHALL menampilkan foto bukti pengiriman yang diupload Carrier setelah status `arrived`.

---

### Requirement 7: Konfirmasi Penerimaan oleh Buyer

**User Story:** Sebagai Buyer, saya ingin mengkonfirmasi bahwa barang sudah saya terima, agar dana komisi dapat dicairkan ke Carrier.

#### Acceptance Criteria

1. WHILE Carry_Order berstatus `arrived` dan `proofPhotoUrl` sudah terisi, THE Buyer_Order_Page SHALL menampilkan tombol "Barang Diterima & Jasa Selesai".
2. WHEN Buyer mengklik "Barang Diterima & Jasa Selesai", THE CarrierContext SHALL mengubah status Carry_Order menjadi `completed` dan mencatat `completedAt` dengan timestamp saat ini.
3. WHEN status Carry_Order berubah menjadi `completed`, THE CarrierContext SHALL mengirim notifikasi ke Admin bahwa ada komisi Carrier yang perlu dicairkan.
4. WHEN status Carry_Order berubah menjadi `completed`, THE CarrierContext SHALL mengirim notifikasi ke Carrier bahwa tugas selesai dan komisi sedang diproses.
5. IF Carry_Order belum berstatus `arrived` atau `proofPhotoUrl` masih null, THEN THE Buyer_Order_Page SHALL tidak menampilkan tombol "Barang Diterima & Jasa Selesai".

---

### Requirement 8: Pencairan Komisi Carrier

**User Story:** Sebagai Admin, saya ingin mencairkan komisi ke E-Wallet Carrier setelah Buyer mengkonfirmasi penerimaan, agar Carrier mendapatkan pembayaran yang adil setelah dipotong biaya admin.

#### Acceptance Criteria

1. THE CarrierContext SHALL menghitung komisi bersih Carrier menggunakan formula: `komisi_bersih = estimatedFee * (1 - adminFeePercent / 100)`.
2. WHEN Admin mengklik "Cairkan Komisi" pada sebuah Carry_Order berstatus `completed` di Admin_Dashboard, THE CarrierContext SHALL menambahkan `komisi_bersih` ke field `balance` Carrier di localStorage `cr_users`.
3. WHEN komisi berhasil dicairkan, THE CarrierContext SHALL mengirim notifikasi ke Carrier dengan jumlah komisi yang diterima dan sisa setelah potongan admin.
4. WHEN komisi berhasil dicairkan, THE CarrierContext SHALL mengirim notifikasi ke Buyer bahwa transaksi jasa angkut telah selesai sepenuhnya.
5. THE Admin_Dashboard SHALL menampilkan daftar Carry_Order berstatus `completed` yang belum dicairkan komisinya, beserta detail estimasi biaya, potongan admin, dan komisi bersih.
6. IF Admin mencoba mencairkan komisi untuk Carry_Order yang sudah pernah dicairkan, THEN THE CarrierContext SHALL menampilkan pesan error dan mencegah pencairan ganda.

---

### Requirement 9: Sistem Rating Carrier

**User Story:** Sebagai Buyer, saya ingin memberikan rating bintang kepada Carrier setelah jasa selesai, agar kualitas layanan Carrier dapat diketahui oleh pengguna lain.

#### Acceptance Criteria

1. WHILE Carry_Order berstatus `completed`, THE Buyer_Order_Page SHALL menampilkan komponen rating bintang 1 sampai 5 untuk menilai Carrier.
2. WHEN Buyer memilih rating dan mengkonfirmasi, THE CarrierContext SHALL menyimpan nilai rating ke field `carrierRating` pada Carry_Order di localStorage `cr_carry_orders`.
3. WHEN rating baru disimpan, THE CarrierContext SHALL menghitung ulang rata-rata rating Carrier dari semua Carry_Order yang memiliki `carrierRating` tidak null, dan memperbarui field `rating` pada data Carrier di localStorage `cr_users`.
4. IF Buyer sudah memberikan rating pada sebuah Carry_Order (field `carrierRating` tidak null), THEN THE Buyer_Order_Page SHALL menampilkan rating yang sudah diberikan dalam mode read-only dan tidak menampilkan form rating ulang.
5. THE Carrier_Dashboard SHALL menampilkan rata-rata rating terkini Carrier yang sedang login, dihitung dari semua Carry_Order yang telah diselesaikan.

---

### Requirement 10: Halaman Riwayat dan Status Pesanan Jasa

**User Story:** Sebagai Buyer, saya ingin melihat status dan riwayat pesanan jasa angkut saya, agar saya bisa memantau progres pengiriman kapan saja.

#### Acceptance Criteria

1. THE Buyer_Order_Page SHALL menampilkan daftar semua Carry_Order milik Buyer yang sedang login, diurutkan berdasarkan `createdAt` terbaru.
2. THE Buyer_Order_Page SHALL menampilkan status terkini setiap Carry_Order dengan label yang mudah dipahami dalam Bahasa Indonesia.
3. WHEN Buyer mengklik sebuah Carry_Order, THE System SHALL menampilkan detail lengkap Carry_Order termasuk: nama Carrier (jika sudah diklaim), Pickup_Point, Dropoff_Point, deskripsi barang, jadwal, estimasi biaya, dan foto bukti (jika sudah ada).
4. THE Carrier_Dashboard SHALL menampilkan riwayat semua Carry_Order yang pernah diklaim dan diselesaikan oleh Carrier yang sedang login, beserta total komisi yang sudah diterima.

---

### Requirement 11: Integrasi dengan Halaman ReloveCarry

**User Story:** Sebagai Buyer, saya ingin bisa langsung memesan jasa angkut dari halaman ReloveCarry yang sudah ada, agar pengalaman pemesanan lebih terintegrasi.

#### Acceptance Criteria

1. THE ReloveCarry_Page SHALL menampilkan tombol "Pesan Jasa Angkut" yang mengarahkan Buyer ke halaman checkout jasa angkut mandiri (tanpa harus terkait dengan order produk).
2. WHEN Buyer yang belum login mengklik "Pesan Jasa Angkut", THE System SHALL mengarahkan Buyer ke halaman login dengan pesan bahwa login diperlukan untuk memesan jasa angkut.
3. THE ReloveCarry_Page SHALL menampilkan daftar Carrier yang terdaftar dan terverifikasi (`isCarrierVerified: true`) dari localStorage `cr_users`, menggantikan data statis yang saat ini ada.
4. THE ReloveCarry_Page SHALL menampilkan status ketersediaan Carrier secara dinamis berdasarkan apakah Carrier memiliki Carry_Order aktif (status antara `claimed` dan `arrived`).
