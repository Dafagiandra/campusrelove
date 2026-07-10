# Requirements Document

## Introduction

Fitur **Order Notification & Chat** menambahkan alur transaksi lengkap ke platform CampusRelove — marketplace thrifting mahasiswa berbasis React + localStorage. Fitur ini mencakup tiga area utama:

1. **Alur Pesanan** — dari checkout pembeli hingga dana diteruskan ke penjual, melewati validasi admin (escrow).
2. **Notifikasi Pesanan** — notifikasi otomatis berbasis sistem (pesan sistem) yang dikirim ke penjual, pembeli, dan admin di setiap perubahan status pesanan.
3. **Chat Langsung** — percakapan real-time (simulasi localStorage) antara pembeli dan penjual untuk tanya jawab barang atau koordinasi COD.

Semua data disimpan di `localStorage` karena tidak ada backend nyata. Sistem ini sepenuhnya disimulasikan di sisi frontend.

---

## Glossary

- **Order_System**: Modul yang mengelola siklus hidup pesanan dari checkout hingga selesai.
- **Notification_System**: Modul yang membuat dan menyimpan notifikasi sistem ke localStorage.
- **Chat_System**: Modul yang mengelola percakapan langsung antara Buyer dan Seller.
- **Escrow**: Mekanisme penahanan dana di rekening bersama (disimulasikan) sampai Admin memvalidasi pembayaran.
- **Buyer**: Pengguna dengan role `buyer` yang melakukan pembelian.
- **Seller**: Pengguna dengan role `seller` yang menjual barang.
- **Admin**: Pengguna dengan role `admin` yang memvalidasi pembayaran dan meneruskan dana.
- **Order**: Entitas yang merepresentasikan satu transaksi pembelian barang.
- **Order_Status**: Status pesanan yang berurutan: `pending_payment` → `paid` → `processing` → `shipped` → `delivered` → `completed` | `cancelled`.
- **System_Message**: Pesan otomatis yang dibuat oleh Notification_System, bukan oleh pengguna.
- **Direct_Message**: Pesan yang dikirim langsung oleh Buyer atau Seller dalam satu percakapan.
- **Conversation**: Satu thread percakapan antara Buyer dan Seller untuk satu produk tertentu.
- **Notification**: Entri pemberitahuan yang ditampilkan di inbox notifikasi pengguna.
- **Deadline_Timer**: Batas waktu 2×24 jam (48 jam) bagi Seller untuk memproses pesanan setelah status `paid`.

---

## Requirements

### Requirement 1: Checkout dan Pembuatan Pesanan

**User Story:** Sebagai Buyer, saya ingin melakukan checkout dan membayar barang, sehingga pesanan saya tercatat dan menunggu validasi Admin.

#### Acceptance Criteria

1. WHEN Buyer menekan tombol "Beli Sekarang" pada halaman detail produk, THE Order_System SHALL menampilkan halaman konfirmasi pesanan yang berisi detail barang, harga, dan metode pembayaran.
2. WHEN Buyer mengkonfirmasi pesanan, THE Order_System SHALL membuat entri Order baru di localStorage dengan status `pending_payment`, `orderId` unik, `buyerId`, `sellerId`, `productId`, `price`, dan `createdAt`.
3. WHEN Order baru dibuat, THE Notification_System SHALL membuat System_Message ke Admin yang berisi detail pesanan dan instruksi validasi pembayaran.
4. WHEN Order baru dibuat, THE Notification_System SHALL membuat Notification ke Buyer dengan status "Pesanan dibuat, menunggu konfirmasi pembayaran".
5. IF Buyer belum login saat menekan "Beli Sekarang", THEN THE Order_System SHALL mengarahkan Buyer ke halaman login sebelum melanjutkan checkout.
6. IF produk yang dibeli memiliki `stock` sama dengan 0, THEN THE Order_System SHALL mencegah checkout dan menampilkan pesan "Stok habis".

---

### Requirement 2: Validasi Pembayaran oleh Admin

**User Story:** Sebagai Admin, saya ingin memvalidasi pembayaran yang masuk ke Escrow, sehingga Seller dapat mulai memproses pesanan hanya setelah dana aman.

#### Acceptance Criteria

1. WHEN Admin membuka tab "Pesanan" di Admin Dashboard, THE Order_System SHALL menampilkan semua Order dengan status `pending_payment` beserta detail pembeli, penjual, barang, dan jumlah pembayaran.
2. WHEN Admin mengklik "Konfirmasi Pembayaran" pada suatu Order, THE Order_System SHALL mengubah status Order menjadi `paid` dan mencatat `paidAt` timestamp.
3. WHEN status Order berubah menjadi `paid`, THE Notification_System SHALL membuat Notification ke Seller bahwa pesanan baru masuk dan perlu diproses.
4. WHEN status Order berubah menjadi `paid`, THE Notification_System SHALL membuat Notification ke Buyer bahwa pembayaran telah dikonfirmasi.
5. WHEN Order berstatus `paid` telah melewati Deadline_Timer tanpa tindakan dari Seller, THE Order_System SHALL menandai Order tersebut sebagai `overdue` dan menampilkan peringatan di Admin Dashboard.
6. IF Admin menolak pembayaran, THEN THE Order_System SHALL mengubah status Order menjadi `cancelled` dan THE Notification_System SHALL membuat Notification ke Buyer bahwa pembayaran ditolak.

---

### Requirement 3: Tindakan Seller terhadap Pesanan Masuk

**User Story:** Sebagai Seller, saya ingin melihat pesanan masuk dan memilih untuk menerima atau menolak, sehingga saya dapat mengelola stok dan komitmen pengiriman saya.

#### Acceptance Criteria

1. WHEN Seller membuka tab "Pesanan Masuk" di Seller Dashboard, THE Order_System SHALL menampilkan semua Order dengan status `paid` yang terkait dengan `sellerId` Seller tersebut.
2. WHEN Seller mengklik "Proses Pesanan" pada suatu Order, THE Order_System SHALL mengubah status Order menjadi `processing` dan mencatat `processedAt` timestamp.
3. WHEN status Order berubah menjadi `processing`, THE Notification_System SHALL membuat Notification ke Buyer bahwa pesanan sedang diproses oleh Seller.
4. WHEN Seller mengklik "Tolak Pesanan" pada suatu Order, THE Order_System SHALL mengubah status Order menjadi `cancelled` dan THE Notification_System SHALL membuat Notification ke Buyer dan Admin bahwa pesanan ditolak oleh Seller.
5. WHILE Order berstatus `paid`, THE Order_System SHALL menampilkan sisa waktu Deadline_Timer (48 jam) kepada Seller.
6. IF Seller menolak pesanan, THEN THE Order_System SHALL mengembalikan nilai `stock` produk terkait sebesar 1.

---

### Requirement 4: Pengemasan dan Pengiriman

**User Story:** Sebagai Seller, saya ingin menginput nomor resi atau mengatur jadwal COD setelah memproses pesanan, sehingga Buyer dapat melacak atau mempersiapkan pengambilan barang.

#### Acceptance Criteria

1. WHEN Order berstatus `processing`, THE Order_System SHALL menampilkan form kepada Seller untuk memilih metode pengiriman: "Kirim via Ekspedisi" atau "COD (Janjian Langsung)".
2. WHEN Seller memilih "Kirim via Ekspedisi" dan menginput nomor resi, THE Order_System SHALL menyimpan nomor resi ke Order dan mengubah status menjadi `shipped`.
3. WHEN Seller memilih "COD" dan menginput jadwal (tanggal, waktu, lokasi), THE Order_System SHALL menyimpan detail COD ke Order dan mengubah status menjadi `shipped`.
4. WHEN status Order berubah menjadi `shipped`, THE Notification_System SHALL membuat Notification ke Buyer yang berisi metode pengiriman dan detail resi atau jadwal COD.
5. IF Seller menginput nomor resi yang kosong saat memilih ekspedisi, THEN THE Order_System SHALL mencegah perubahan status dan menampilkan pesan validasi.

---

### Requirement 5: Konfirmasi Penerimaan Barang dan Penyelesaian

**User Story:** Sebagai Buyer, saya ingin mengkonfirmasi bahwa barang sudah saya terima, sehingga dana dapat diteruskan ke Seller oleh Admin.

#### Acceptance Criteria

1. WHEN Order berstatus `shipped`, THE Order_System SHALL menampilkan tombol "Terima Barang" kepada Buyer di halaman riwayat pesanan.
2. WHEN Buyer mengklik "Terima Barang", THE Order_System SHALL mengubah status Order menjadi `delivered` dan mencatat `deliveredAt` timestamp.
3. WHEN status Order berubah menjadi `delivered`, THE Notification_System SHALL membuat Notification ke Admin untuk meneruskan dana ke saldo Seller.
4. WHEN Admin mengklik "Teruskan Dana" pada Order berstatus `delivered`, THE Order_System SHALL mengubah status Order menjadi `completed`, mencatat `completedAt`, dan menambahkan nilai `price` ke field `balance` milik Seller di localStorage.
5. WHEN status Order berubah menjadi `completed`, THE Notification_System SHALL membuat Notification ke Seller bahwa dana telah diteruskan ke saldo mereka.
6. WHEN status Order berubah menjadi `completed`, THE Notification_System SHALL membuat Notification ke Buyer bahwa transaksi selesai.

---

### Requirement 6: Inbox Notifikasi Pengguna

**User Story:** Sebagai pengguna (Buyer, Seller, atau Admin), saya ingin melihat semua notifikasi saya di satu tempat, sehingga saya tidak melewatkan pembaruan penting terkait pesanan.

#### Acceptance Criteria

1. THE Notification_System SHALL menyimpan setiap Notification ke localStorage dengan field: `notifId`, `recipientId`, `type`, `message`, `orderId`, `isRead`, dan `createdAt`.
2. WHEN pengguna membuka halaman atau ikon notifikasi, THE Notification_System SHALL menampilkan daftar Notification milik pengguna tersebut, diurutkan dari yang terbaru.
3. WHEN pengguna mengklik suatu Notification, THE Notification_System SHALL menandai Notification tersebut sebagai `isRead: true` dan mengarahkan pengguna ke halaman detail Order terkait.
4. THE Notification_System SHALL menampilkan jumlah Notification yang belum dibaca (`isRead: false`) sebagai badge di ikon notifikasi pada Navbar.
5. WHEN semua Notification telah dibaca, THE Notification_System SHALL menyembunyikan badge notifikasi.

---

### Requirement 7: Chat Langsung Buyer–Seller

**User Story:** Sebagai Buyer, saya ingin mengirim pesan langsung ke Seller untuk menanyakan detail barang atau mengatur COD, sehingga saya dapat membuat keputusan pembelian yang lebih baik.

#### Acceptance Criteria

1. WHEN Buyer mengklik tombol "Chat Penjual" pada halaman detail produk, THE Chat_System SHALL membuka atau melanjutkan Conversation antara Buyer dan Seller untuk produk tersebut.
2. THE Chat_System SHALL menyimpan setiap Conversation di localStorage dengan field: `conversationId`, `buyerId`, `sellerId`, `productId`, dan `messages` (array).
3. WHEN Buyer atau Seller mengirim Direct_Message, THE Chat_System SHALL menambahkan pesan ke array `messages` pada Conversation terkait dengan field: `messageId`, `senderId`, `text`, `sentAt`, dan `isRead`.
4. WHEN Seller membuka Seller Dashboard tab "Pesan", THE Chat_System SHALL menampilkan semua Conversation aktif milik Seller tersebut beserta pesan terakhir dan jumlah pesan belum dibaca.
5. WHEN pengguna membuka suatu Conversation, THE Chat_System SHALL menandai semua Direct_Message yang belum dibaca sebagai `isRead: true`.
6. IF Buyer belum login saat mengklik "Chat Penjual", THEN THE Chat_System SHALL mengarahkan Buyer ke halaman login sebelum membuka chat.

---

### Requirement 8: Pesan Sistem Otomatis dalam Chat

**User Story:** Sebagai pengguna, saya ingin melihat pembaruan status pesanan secara otomatis di dalam thread chat, sehingga saya memiliki riwayat lengkap komunikasi dan status dalam satu tempat.

#### Acceptance Criteria

1. WHEN status Order berubah, THE Notification_System SHALL menambahkan System_Message ke Conversation terkait (jika Conversation sudah ada) dengan `senderId: 'system'` dan teks yang mendeskripsikan perubahan status.
2. THE Chat_System SHALL menampilkan System_Message dengan tampilan visual yang berbeda dari Direct_Message (misalnya, teks berwarna abu-abu dan terpusat).
3. WHEN System_Message ditambahkan ke Conversation, THE Chat_System SHALL TIDAK menghitung System_Message sebagai pesan belum dibaca dalam badge counter.

---

### Requirement 9: Pemantauan Pesanan oleh Admin

**User Story:** Sebagai Admin, saya ingin memantau semua pesanan aktif dan mendeteksi pesanan yang tidak direspon, sehingga saya dapat mengambil tindakan untuk melindungi Buyer dan Seller.

#### Acceptance Criteria

1. WHEN Admin membuka tab "Pesanan" di Admin Dashboard, THE Order_System SHALL menampilkan semua Order dari semua Seller, dikelompokkan berdasarkan status.
2. WHEN suatu Order berstatus `paid` dan Deadline_Timer telah habis, THE Order_System SHALL menampilkan indikator visual "Overdue" pada Order tersebut di Admin Dashboard.
3. WHEN Admin mengklik "Batalkan Pesanan" pada Order yang overdue, THE Order_System SHALL mengubah status Order menjadi `cancelled` dan THE Notification_System SHALL membuat Notification ke Buyer dan Seller.
4. THE Order_System SHALL menampilkan ringkasan statistik pesanan di Admin Dashboard: total pesanan, pesanan pending, pesanan aktif, dan pesanan selesai.
