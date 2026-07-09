/**
 * trustBadge.js — Hitung badge kepercayaan penjual
 *
 * Badge muncul dari transaksi NYATA di sistem, bukan klaim sepihak.
 * Sumber data: orders (completed), users (rating, verified).
 */

/**
 * getSellerTrustBadges — hitung badge dari transaksi RESMI lewat sistem
 * Transaksi cod_cash (offline) tidak dihitung sama sekali
 */
export function getSellerTrustBadges(seller) {
  if (!seller) return []

  const badges = []
  const sales   = Number(seller.totalSales)  || Number(seller.total_sales)  || 0
  const rating  = Number(seller.rating)      || 0
  const verified = Boolean(seller.verified)  || seller.verificationStatus === 'approved'

  // 1. Identitas Terverifikasi (KTP/SIM dikonfirmasi admin)
  if (verified) {
    badges.push({
      id:    'verified_id',
      label: 'Identitas Terverifikasi',
      icon:  '✅',
      color: '#065f46',
      bg:    '#d1fae5',
      desc:  'KTP/SIM dikonfirmasi oleh Admin Preloved',
    })
  }

  // 2. Penjual Terpercaya (≥5 transaksi selesai)
  if (sales >= 5) {
    badges.push({
      id:    'trusted_seller',
      label: 'Penjual Terpercaya',
      icon:  '🏆',
      color: '#92400e',
      bg:    '#fef3c7',
      desc:  `${sales} transaksi berhasil lewat sistem`,
    })
  }

  // 3. Top Seller (≥20 transaksi)
  if (sales >= 20) {
    badges.push({
      id:    'top_seller',
      label: 'Top Seller',
      icon:  '⭐',
      color: '#7C3AED',
      bg:    '#ede9fe',
      desc:  `${sales} transaksi selesai`,
    })
  }

  // 4. Rating tinggi (≥4.5 dari ulasan nyata)
  if (rating >= 4.5 && sales >= 3) {
    badges.push({
      id:    'high_rating',
      label: `Rating ${rating.toFixed(1)}★`,
      icon:  '⭐',
      color: '#1d4ed8',
      bg:    '#dbeafe',
      desc:  'Rating tinggi dari pembeli nyata',
    })
  }

  return badges
}

/**
 * Banner proteksi transaksi — tampil di halaman produk untuk meyakinkan pembeli
 */
export const TRANSACTION_PROTECTION = {
  icon:  '🔒',
  title: 'Transaksi Dilindungi Escrow',
  desc:  'Pilih "Bayar via Aplikasi" untuk perlindungan platform. Dana ditahan sampai barang diterima. Bisa komplain jika bermasalah.',
  items: [
    { icon: '🔒', text: 'Dana ditahan sampai kamu konfirmasi terima barang (jika bayar via aplikasi)' },
    { icon: '⚠️', text: 'Bisa komplain jika barang tidak sesuai (khusus transaksi via aplikasi)' },
    { icon: '👤', text: 'Semua penjual sudah verifikasi identitas' },
    { icon: '💬', text: 'Komunikasi aman lewat chat dalam aplikasi' },
    { icon: '⭐', text: 'Rating/ulasan hanya dari transaksi resmi via aplikasi' },
  ],
}
