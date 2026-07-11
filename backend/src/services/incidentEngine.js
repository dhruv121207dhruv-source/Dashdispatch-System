/**
 * Incident Engine
 * Every 60 seconds, randomly triggers a chaos event and emits it via WebSocket.
 */

const prisma = require('../db');
const { optimizeRoutes } = require('./routeOptimizer');
const simulator = require('./driverSimulator');

const INCIDENT_TYPES = ['TRAFFIC_SPIKE', 'VEHICLE_BREAKDOWN', 'CUSTOMER_CANCELLATION'];
const SEVERITY_MAP = {
  TRAFFIC_SPIKE: 'yellow',
  VEHICLE_BREAKDOWN: 'red',
  CUSTOMER_CANCELLATION: 'red',
  MANUAL_REASSIGN: 'gray',
  ROUTE_UPDATED: 'gray',
};

let io = null;

function init(socketIo) {
  io = socketIo;
}

function emitChaosEvent(event) {
  if (!io) return;
  io.emit('chaos_event', {
    ...event,
    severity: SEVERITY_MAP[event.type] || 'gray',
    timestamp: new Date().toISOString(),
  });
}

async function triggerIncident() {
  try {
    // Pick a random incident type
    const type = INCIDENT_TYPES[Math.floor(Math.random() * INCIDENT_TYPES.length)];

    if (type === 'TRAFFIC_SPIKE') {
      // Mark a random IN_TRANSIT delivery as DELAYED
      const delivery = await prisma.delivery.findFirst({
        where: { status: 'IN_TRANSIT' },
        include: { assignedDriver: true },
      });
      if (!delivery) return;

      await prisma.delivery.update({ where: { id: delivery.id }, data: { status: 'DELAYED' } });
      emitChaosEvent({
        type,
        message: `🚦 Traffic spike! Package #${delivery.id} (${delivery.label || 'Delivery'}) is now DELAYED.`,
        affectedDeliveryId: delivery.id,
        affectedDriverId: delivery.assignedDriverId,
      });

    } else if (type === 'VEHICLE_BREAKDOWN') {
      // Mark a random BUSY driver as OFFLINE, reassign their deliveries
      const driver = await prisma.driver.findFirst({
        where: { status: 'BUSY' },
        include: { deliveries: { where: { status: { in: ['IN_TRANSIT', 'PENDING'] } } } },
      });
      if (!driver) return;

      await prisma.driver.update({ where: { id: driver.id }, data: { status: 'OFFLINE' } });
      simulator.setDriverStatus(driver.id, 'OFFLINE');

      // Re-assign their deliveries to another BUSY/AVAILABLE driver
      const replacementDriver = await prisma.driver.findFirst({
        where: { status: { in: ['AVAILABLE', 'BUSY'] }, id: { not: driver.id } },
      });

      if (replacementDriver && driver.deliveries.length > 0) {
        await prisma.delivery.updateMany({
          where: { id: { in: driver.deliveries.map(d => d.id) } },
          data: { assignedDriverId: replacementDriver.id },
        });

        // Recalculate route for replacement driver
        const deliveries = await prisma.delivery.findMany({
          where: { assignedDriverId: replacementDriver.id, status: { in: ['PENDING', 'IN_TRANSIT'] } },
        });
        const repState = simulator.getDriverState(replacementDriver.id);
        const routes = await optimizeRoutes(
          { lat: process.env.DEPOT_LAT || 40.7128, lng: process.env.DEPOT_LNG || -74.0060 },
          [{ id: replacementDriver.id, lat: repState?.lat || replacementDriver.currentLat, lng: repState?.lng || replacementDriver.currentLng }],
          deliveries.map(d => ({ id: d.id, lat: d.destinationLat, lng: d.destinationLng }))
        );
        if (routes[0]) {
          simulator.assignRoute(replacementDriver.id, routes[0].polyline);
          await prisma.routeHistory.create({
            data: { driverId: replacementDriver.id, routePolyline: routes[0].polyline },
          });
          io.emit('route_update', routes);
        }
      }

      emitChaosEvent({
        type,
        message: `🔧 Driver ${driver.name} broke down! ${driver.deliveries.length} packages reassigned.`,
        affectedDriverId: driver.id,
      });

    } else if (type === 'CUSTOMER_CANCELLATION') {
      // Cancel a random pending delivery
      const delivery = await prisma.delivery.findFirst({ where: { status: 'PENDING' } });
      if (!delivery) return;

      await prisma.delivery.update({ where: { id: delivery.id }, data: { status: 'DELIVERED' } });
      emitChaosEvent({
        type,
        message: `❌ Customer cancelled Package #${delivery.id} (${delivery.label || 'Delivery'}).`,
        affectedDeliveryId: delivery.id,
      });
    }

    // Push updated delivery stats to all clients
    const stats = await computeKPIs();
    io.emit('kpi_update', stats);

  } catch (err) {
    console.error('[IncidentEngine] Error during incident:', err.message);
  }
}

async function computeKPIs() {
  const [total, delivered, delayed, inTransit] = await Promise.all([
    prisma.delivery.count(),
    prisma.delivery.count({ where: { status: 'DELIVERED' } }),
    prisma.delivery.count({ where: { status: 'DELAYED' } }),
    prisma.delivery.count({ where: { status: 'IN_TRANSIT' } }),
  ]);
  const busyDrivers = await prisma.driver.count({ where: { status: 'BUSY' } });
  const onTimeRate = total > 0 ? Math.round(((total - delayed) / total) * 100) : 100;
  return { activeDrivers: busyDrivers, onTimeRate, delayedPackages: delayed, inTransitPackages: inTransit, totalDeliveries: total };
}

function start() {
  setInterval(triggerIncident, 60000);
  console.log('[IncidentEngine] Chaos engine started (60s interval).');
}

module.exports = { init, start, emitChaosEvent, computeKPIs };
