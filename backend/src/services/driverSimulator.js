/**
 * Driver Simulator Service
 * Moves drivers along their assigned route segments every 3 seconds.
 * Emits `driver_locations_update` via Socket.io.
 */

const prisma = require('../db');

// In-memory state: driverId -> { lat, lng, route: [[lat,lng],...], routeIndex, status }
const driverState = new Map();

let io = null;

function init(socketIo) {
  io = socketIo;
}

/**
 * Assign a route polyline to a driver in memory.
 */
function assignRoute(driverId, polyline, status = 'BUSY') {
  const existing = driverState.get(driverId) || {};
  driverState.set(driverId, {
    lat: existing.lat || parseFloat(process.env.DEPOT_LAT) || 40.7128,
    lng: existing.lng || parseFloat(process.env.DEPOT_LNG) || -74.0060,
    route: polyline || [],
    routeIndex: 0,
    status,
  });
}

/**
 * Load all drivers from DB into memory on startup.
 */
async function loadDriversFromDB() {
  const drivers = await prisma.driver.findMany();
  drivers.forEach(d => {
    if (!driverState.has(d.id)) {
      driverState.set(d.id, {
        lat: d.currentLat,
        lng: d.currentLng,
        route: [],
        routeIndex: 0,
        status: d.status,
      });
    }
  });
  console.log(`[Simulator] Loaded ${drivers.length} drivers into memory.`);
}

/**
 * Nudge each BUSY driver one step along their route polyline.
 * Updates DB + emits socket event.
 */
async function tick() {
  if (!io) return;

  const updates = [];

  for (const [driverId, state] of driverState.entries()) {
    if (state.status !== 'BUSY' || state.route.length === 0) {
      updates.push({ id: driverId, lat: state.lat, lng: state.lng, status: state.status });
      continue;
    }

    // Interpolate: move toward next waypoint
    const target = state.route[Math.min(state.routeIndex, state.route.length - 1)];
    const [targetLat, targetLng] = target;

    // Small step (roughly 20m per tick)
    const STEP = 0.0002;
    const dLat = targetLat - state.lat;
    const dLng = targetLng - state.lng;
    const dist = Math.sqrt(dLat ** 2 + dLng ** 2);

    if (dist < STEP) {
      // Reached waypoint — advance to next
      state.routeIndex = Math.min(state.routeIndex + 1, state.route.length - 1);
      state.lat = targetLat;
      state.lng = targetLng;
    } else {
      state.lat += (dLat / dist) * STEP;
      state.lng += (dLng / dist) * STEP;
    }

    updates.push({ id: driverId, lat: state.lat, lng: state.lng, status: state.status });

    // Async DB update (fire-and-forget to avoid slow ticks)
    prisma.driver.update({
      where: { id: driverId },
      data: { currentLat: state.lat, currentLng: state.lng },
    }).catch(err => console.warn('[Simulator] DB update failed:', err.message));
  }

  io.emit('driver_locations_update', updates);
}

/**
 * Set a driver's status in memory (used by incident engine).
 */
function setDriverStatus(driverId, status) {
  const state = driverState.get(driverId);
  if (state) state.status = status;
}

/**
 * Get current in-memory driver state.
 */
function getDriverState(driverId) {
  return driverState.get(driverId);
}

function getAllDriverStates() {
  const result = [];
  for (const [id, state] of driverState.entries()) {
    result.push({ id, ...state });
  }
  return result;
}

/**
 * Start the simulation loop.
 */
function start() {
  setInterval(tick, 3000);
  console.log('[Simulator] Driver location ticker started (3s interval).');
}

module.exports = { init, start, loadDriversFromDB, assignRoute, setDriverStatus, getDriverState, getAllDriverStates };
