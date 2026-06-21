/**
 * LeafletMap.jsx — Safe Leaflet wrapper for Vite
 * Uses mounted guard + error boundary to prevent "render2 is not a function".
 */
import { useState, useEffect, Component } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix leaflet default icon — run once
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Error boundary that catches Leaflet render errors
class MapErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: this.props.height || 260,
          background: '#f3f4f6', borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#9ca3af', fontSize: '0.82rem', gap: 6,
          flexDirection: 'column',
        }}>
          <span>🗺️</span>
          <span>Peta tidak tersedia</span>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * SafeMap — wraps MapContainer with:
 * 1. mounted guard (waits for DOM ready)
 * 2. error boundary (catches Leaflet render errors)
 *
 * Props:
 *   height      — number (px), default 260
 *   center      — [lat, lng]
 *   zoom        — number, default 13
 *   interactive — boolean, default false
 */
export function SafeMap({ height = 260, center, zoom = 13, interactive = false, children }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Small delay ensures DOM is fully ready for Leaflet
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const placeholder = (
    <div style={{
      height,
      background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
      borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#9ca3af', fontSize: '0.82rem', gap: 6,
    }}>
      🗺️ Memuat peta...
    </div>
  )

  if (!mounted || !center || !center[0] || !center[1]) return placeholder

  return (
    <MapErrorBoundary height={height}>
      <MapContainer
        key={`${center[0]}-${center[1]}-${zoom}`}
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        attributionControl={false}
      >
        {children}
      </MapContainer>
    </MapErrorBoundary>
  )
}

export { TileLayer, Marker, useMapEvents, L }
