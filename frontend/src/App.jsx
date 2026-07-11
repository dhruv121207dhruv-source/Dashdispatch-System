import { useEffect, useState, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import KPIHeader from './components/KPIHeader';
import LiveMap from './components/LiveMap';
import ChaosFeed from './components/ChaosFeed';
import DriverList from './components/DriverList';

// Toast notification
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = { success: '#00ff88', error: '#ff4444', info: '#00d4ff' };
  const color = colors[type] || colors.info;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 18px', borderRadius: 10,
      background: 'rgba(13,21,38,0.95)', backdropFilter: 'blur(12px)',
      border: `1px solid ${color}55`,
      boxShadow: `0 4px 24px ${color}22`,
      animation: 'slide-in-right 0.3s ease',
      maxWidth: 340,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: '#e8f4ff', flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', color: '#6b8aaa', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}

export default function App() {
  const { connected, driverLocations, chaosEvents, kpis, routes, emitManualReassign } = useSocket();
  const [drivers, setDrivers] = useState([]);
  const [toast, setToast] = useState(null);

  // Fetch driver list with their deliveries on mount
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const res = await fetch('/api/drivers');
        if (res.ok) {
          const data = await res.json();
          setDrivers(data);
        } else {
          throw new Error('API not ok');
        }
      } catch (err) {
        console.warn('[App] Failed to fetch drivers, using demo data:', err.message);
        setDrivers([
          { id: 1, name: 'Alex Rivera (Demo)', status: 'BUSY', deliveries: [{id: 101, status: 'IN_TRANSIT', destinationLat: 40.7138, destinationLng: -74.0050}] },
          { id: 2, name: 'Jordan Chen (Demo)', status: 'BUSY', deliveries: [{id: 102, status: 'IN_TRANSIT', destinationLat: 40.7108, destinationLng: -74.0080}] },
          { id: 3, name: 'Sam Patel (Demo)', status: 'AVAILABLE', deliveries: [] },
          { id: 4, name: 'Morgan Lee (Demo)', status: 'OFFLINE', deliveries: [] },
        ]);
      }
    };
    fetchDrivers();
    // Refresh driver data every 15s to get updated delivery assignments
    const interval = setInterval(fetchDrivers, 15000);
    return () => clearInterval(interval);
  }, []);

  // Refresh drivers when a route update comes in
  useEffect(() => {
    if (Object.keys(routes).length > 0) {
      fetch('/api/drivers')
        .then(r => r.json())
        .then(setDrivers)
        .catch(() => {});
    }
  }, [routes]);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const handleDropPackage = useCallback((packageId, newDriverId) => {
    emitManualReassign(packageId, newDriverId);
    const driver = drivers.find(d => d.id === newDriverId);
    showToast(
      `📦 Package #${packageId} reassigned to ${driver?.name || `Driver #${newDriverId}`}`,
      'success'
    );
  }, [emitManualReassign, drivers, showToast]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg-base)',
      overflow: 'hidden',
    }}>
      {/* Sticky KPI Header */}
      <KPIHeader kpis={kpis} connected={connected} />

      {/* Main 3-column layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Left: Driver Fleet */}
        <DriverList
          drivers={drivers}
          driverLocations={driverLocations}
          onDropPackage={handleDropPackage}
        />

        {/* Center: Live Map */}
        <LiveMap
          driverLocations={driverLocations}
          drivers={drivers}
          routes={routes}
          onDropPackage={handleDropPackage}
        />

        {/* Right: Chaos Feed */}
        <ChaosFeed events={chaosEvents} />
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
