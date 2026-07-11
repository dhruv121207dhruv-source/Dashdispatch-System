import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [driverLocations, setDriverLocations] = useState([]);
  const [chaosEvents, setChaosEvents] = useState([]);
  const [kpis, setKpis] = useState({
    activeDrivers: 0,
    onTimeRate: 100,
    delayedPackages: 0,
    inTransitPackages: 0,
    totalDeliveries: 0,
  });
  const [routes, setRoutes] = useState({});

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setConnected(true);
      setIsDemoMode(false);
    });

    socket.on('connect_error', () => {
      if (!isDemoMode) {
        console.log('[Socket] Connection failed. Falling back to Demo Mode.');
        setIsDemoMode(true);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setConnected(false);
    });

    socket.on('driver_locations_update', setDriverLocations);
    socket.on('chaos_event', event => setChaosEvents(prev => [event, ...prev].slice(0, 50)));
    socket.on('kpi_update', setKpis);
    socket.on('route_update', newRoutes => {
      setRoutes(prev => {
        const updated = { ...prev };
        newRoutes.forEach(r => { updated[r.driverId] = r.polyline; });
        return updated;
      });
    });

    return () => socket.disconnect();
  }, [isDemoMode]);

  // Demo Mode Simulation Loop
  useEffect(() => {
    if (!isDemoMode) return;
    
    // Initial KPIs
    setKpis({
      activeDrivers: 4,
      onTimeRate: 98,
      delayedPackages: 1,
      inTransitPackages: 12,
      totalDeliveries: 45,
    });

    // Simulate Fake Route for driver 1 and 2
    const fakeRoutes = {
      1: [[40.7128, -74.0060], [40.7138, -74.0050], [40.7148, -74.0040], [40.7158, -74.0050], [40.7178, -74.0080]],
      2: [[40.7128, -74.0060], [40.7118, -74.0070], [40.7108, -74.0080], [40.7098, -74.0050], [40.7088, -74.0020]],
    };
    setRoutes(fakeRoutes);

    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      // Animate drivers along fake routes
      const d1Idx = tick % fakeRoutes[1].length;
      const d2Idx = tick % fakeRoutes[2].length;
      
      setDriverLocations([
        { id: 1, lat: fakeRoutes[1][d1Idx][0], lng: fakeRoutes[1][d1Idx][1], status: 'BUSY' },
        { id: 2, lat: fakeRoutes[2][d2Idx][0], lng: fakeRoutes[2][d2Idx][1], status: 'BUSY' },
        { id: 3, lat: 40.7200, lng: -73.9900, status: 'AVAILABLE' },
      ]);

      // Random chaos event every 10 ticks
      if (tick % 10 === 0) {
        setChaosEvents(prev => [{
          type: 'TRAFFIC_SPIKE',
          severity: 'yellow',
          message: '🚦 Demo Incident: Traffic spike simulated!',
          timestamp: new Date().toISOString(),
          affectedDeliveryId: 101,
        }, ...prev].slice(0, 50));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isDemoMode]);

  const emitManualReassign = (packageId, newDriverId) => {
    if (isDemoMode) {
      setChaosEvents(prev => [{
        type: 'MANUAL_REASSIGN',
        severity: 'gray',
        message: `📦 (Demo) Package #${packageId} reassigned to Driver #${newDriverId}.`,
        timestamp: new Date().toISOString(),
      }, ...prev].slice(0, 50));
      return;
    }
    socketRef.current?.emit('manual_reassign', { packageId, newDriverId });
  };

  return { socket: socketRef.current, connected: connected || isDemoMode, isDemoMode, driverLocations, chaosEvents, kpis, routes, emitManualReassign };
}
