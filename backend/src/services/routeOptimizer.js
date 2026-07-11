/**
 * Route Optimizer Service
 * Uses OSRM public API for routing with a Nearest Neighbor TSP fallback.
 */

const axios = require('axios');

const OSRM_BASE = 'http://router.project-osrm.org';

/**
 * Haversine distance between two lat/lng points in km
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Nearest Neighbor TSP — returns ordered indices into `stops`
 */
function nearestNeighborTSP(depot, stops) {
  if (!stops.length) return [];
  const visited = new Set();
  const order = [];
  let current = { lat: depot.lat, lng: depot.lng };

  while (visited.size < stops.length) {
    let bestIdx = -1;
    let bestDist = Infinity;
    stops.forEach((s, i) => {
      if (visited.has(i)) return;
      const d = haversine(current.lat, current.lng, s.lat, s.lng);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    visited.add(bestIdx);
    order.push(bestIdx);
    current = stops[bestIdx];
  }
  return order;
}

/**
 * Decode a Google-encoded polyline string to array of [lat, lng]
 */
function decodePolyline(encoded) {
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

/**
 * Fetch a route polyline from OSRM between ordered waypoints.
 * Falls back to straight-line coords if OSRM fails.
 */
async function fetchOSRMPolyline(waypoints) {
  try {
    const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
    const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=polyline`;
    const res = await axios.get(url, { timeout: 5000 });
    if (res.data.code === 'Ok' && res.data.routes.length > 0) {
      return decodePolyline(res.data.routes[0].geometry);
    }
  } catch (e) {
    console.warn('[RouteOptimizer] OSRM unavailable, using straight-line fallback:', e.message);
  }
  // Fallback: straight-line polyline
  return waypoints.map(w => [w.lat, w.lng]);
}

/**
 * Main optimizer:
 *  - Distributes deliveries round-robin across available drivers
 *  - Orders each driver's stops via TSP
 *  - Fetches OSRM polyline for each driver's route
 *
 * @param {Object} depot   { lat, lng }
 * @param {Array}  drivers [{ id, lat, lng }]
 * @param {Array}  deliveries [{ id, lat, lng }]
 * @returns {Array} [{ driverId, orderedStops, polyline: [[lat,lng],...] }]
 */
async function optimizeRoutes(depot, drivers, deliveries) {
  if (!drivers.length || !deliveries.length) return [];

  // Assign deliveries round-robin
  const driverLoads = drivers.map(d => ({ driver: d, stops: [] }));
  deliveries.forEach((del, i) => {
    driverLoads[i % drivers.length].stops.push(del);
  });

  const assignments = await Promise.all(
    driverLoads.map(async ({ driver, stops }) => {
      if (!stops.length) return { driverId: driver.id, orderedStops: [], polyline: [] };

      const orderedIndices = nearestNeighborTSP(
        { lat: driver.lat, lng: driver.lng },
        stops.map(s => ({ lat: s.lat, lng: s.lng }))
      );
      const orderedStops = orderedIndices.map(i => stops[i]);

      const waypoints = [
        { lat: driver.lat, lng: driver.lng },
        ...orderedStops.map(s => ({ lat: s.lat, lng: s.lng })),
      ];

      const polyline = await fetchOSRMPolyline(waypoints);
      return { driverId: driver.id, orderedStops, polyline };
    })
  );

  return assignments;
}

module.exports = { optimizeRoutes, haversine };
