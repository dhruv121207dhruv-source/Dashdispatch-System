import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEPOT = [40.7128, -74.0060];

const DRIVER_COLORS = ['#00d4ff', '#00ff88', '#ffb800', '#a855f7', '#ff6b6b'];

// Custom HTML marker (truck emoji in a colored circle)
function createDriverIcon(driverIndex, status) {
  const color = status === 'OFFLINE' ? '#555' : DRIVER_COLORS[driverIndex % DRIVER_COLORS.length];
  return L.divIcon({
    className: '',
    html: `
      <div class="driver-marker-icon ${status}" style="border-color:${color};background:${color}22;">
        🚚
      </div>
      <div style="
        position:absolute; bottom:-18px; left:50%; transform:translateX(-50%);
        font-size:9px; color:${color}; font-family:'Inter',sans-serif; font-weight:600;
        white-space:nowrap; text-shadow:0 0 6px ${color};
      ">DRV-${String(driverIndex + 1).padStart(2,'0')}</div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
}

// Depot marker
const depotIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width:36px;height:36px;border-radius:50%;display:flex;align-items:center;
      justify-content:center;background:#0d1526;border:2px solid #00d4ff;font-size:18px;
      box-shadow:0 0 16px #00d4ff88;
    ">🏭</div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// ── AnimatedDriverMarker: smoothly updates position ──────────────────────────
function AnimatedMarker({ driverData, driverIndex, drivers, onDrop }) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (markerRef.current && driverData) {
      markerRef.current.setLatLng([driverData.lat, driverData.lng]);
    }
  }, [driverData?.lat, driverData?.lng]);

  if (!driverData) return null;
  const driver = drivers.find(d => d.id === driverData.id);

  return (
    <Marker
      ref={markerRef}
      position={[driverData.lat, driverData.lng]}
      icon={createDriverIcon(driverIndex, driverData.status)}
      eventHandlers={{
        dragover: (e) => { e.originalEvent.preventDefault(); },
        drop: (e) => {
          e.originalEvent.preventDefault();
          const packageId = parseInt(e.originalEvent.dataTransfer.getData('packageId'));
          if (packageId) onDrop(packageId, driverData.id);
        },
      }}
    >
      <Popup>
        <div style={{ minWidth: 160 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: DRIVER_COLORS[driverIndex % DRIVER_COLORS.length] }}>
            {driver?.name || `Driver #${driverData.id}`}
          </div>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>
            Status: <span style={{ color: '#e8f4ff', fontWeight: 600 }}>{driverData.status}</span>
          </div>
          <div style={{ fontSize: 11, color: '#888', fontFamily: 'JetBrains Mono, monospace' }}>
            {driverData.lat?.toFixed(5)}, {driverData.lng?.toFixed(5)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// ── Drop zone overlay on map for package drop ────────────────────────────────
function MapDropZone({ onDrop }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e) => {
      e.preventDefault();
      // Package dropped on the map but not on a specific driver — ignore
    };
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);
    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, [map]);
  return null;
}

export default function LiveMap({ driverLocations, drivers, routes, onDropPackage }) {
  const handleDrop = useCallback((packageId, driverId) => {
    onDropPackage(packageId, driverId);
  }, [onDropPackage]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {/* Live pulse overlay */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(6,11,24,0.8)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(0,212,255,0.2)',
        borderRadius: 6, padding: '4px 10px',
        pointerEvents: 'none',
      }}>
        <div style={{ position: 'relative', width: 8, height: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d4ff' }} />
          <div className="animate-ping-dot" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#00d4ff' }} />
        </div>
        <span style={{ fontSize: 11, color: '#00d4ff', fontWeight: 600, letterSpacing: '0.08em' }}>LIVE FEED</span>
      </div>

      <MapContainer
        center={DEPOT}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapDropZone onDrop={handleDrop} />

        {/* Depot marker */}
        <Marker position={DEPOT} icon={depotIcon}>
          <Popup>
            <div style={{ color: '#00d4ff', fontWeight: 700 }}>🏭 Dispatch Depot</div>
            <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>
              {DEPOT[0].toFixed(4)}, {DEPOT[1].toFixed(4)}
            </div>
          </Popup>
        </Marker>

        {/* Route polylines */}
        {Object.entries(routes).map(([driverId, polyline], idx) =>
          polyline && polyline.length > 1 ? (
            <Polyline
              key={`route-${driverId}`}
              positions={polyline}
              pathOptions={{
                color: DRIVER_COLORS[idx % DRIVER_COLORS.length],
                weight: 3,
                opacity: 0.75,
                dashArray: '8,4',
              }}
            />
          ) : null
        )}

        {/* Driver markers */}
        {driverLocations.map((dl, idx) => (
          <AnimatedMarker
            key={dl.id}
            driverData={dl}
            driverIndex={idx}
            drivers={drivers}
            onDrop={handleDrop}
          />
        ))}
      </MapContainer>
    </div>
  );
}
