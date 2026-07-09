/**
 * GoogleMapsEmbed — tampilkan Google Maps tanpa API key
 * Pakai iframe embed Google Maps dengan koordinat lat/lng
 * Jauh lebih reliable dari Leaflet di Vite
 */

// ── Embedded map (non-interactive preview) ────────────────────────────────────
export function MapEmbed({ lat, lng, name, height = 200 }) {
  if (!lat || !lng) return null

  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', height, border: '1px solid #e5e7eb' }}>
      <iframe
        title={name || 'Peta Lokasi'}
        src={src}
        width="100%"
        height="100%"
        style={{ border: 0, display: 'block' }}
        allowFullScreen={false}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  )
}

// ── Open in Google Maps button ─────────────────────────────────────────────────
export function OpenInMapsBtn({ lat, lng, name }) {
  if (!lat || !lng) return null
  const url = `https://www.google.com/maps?q=${lat},${lng}`
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none', padding: '5px 10px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
      📍 Buka di Google Maps
    </a>
  )
}

export default MapEmbed
