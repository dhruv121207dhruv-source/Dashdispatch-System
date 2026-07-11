/**
 * Socket.io Event Handlers
 */

const prisma = require('../db');
const { optimizeRoutes } = require('../services/routeOptimizer');
const simulator = require('../services/driverSimulator');
const { emitChaosEvent, computeKPIs } = require('../services/incidentEngine');

function registerHandlers(io, socket) {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Send current driver states on connect
  const allStates = simulator.getAllDriverStates();
  socket.emit('driver_locations_update', allStates);

  // ---------------------------------------------------------
  // manual_reassign: { packageId, newDriverId }
  // ---------------------------------------------------------
  socket.on('manual_reassign', async ({ packageId, newDriverId }) => {
    try {
      console.log(`[Socket] manual_reassign: pkg=${packageId} -> driver=${newDriverId}`);

      const delivery = await prisma.delivery.findUnique({ where: { id: packageId } });
      if (!delivery) return socket.emit('error', { message: 'Delivery not found' });

      const oldDriverId = delivery.assignedDriverId;

      // Update delivery assignment
      await prisma.delivery.update({
        where: { id: packageId },
        data: { assignedDriverId: newDriverId, status: 'IN_TRANSIT' },
      });

      // Recalculate routes for both old and new drivers
      const affectedDriverIds = [newDriverId, ...(oldDriverId && oldDriverId !== newDriverId ? [oldDriverId] : [])];
      const routeUpdates = [];

      for (const driverId of affectedDriverIds) {
        const driver = await prisma.driver.findUnique({ where: { id: driverId } });
        if (!driver) continue;

        const deliveries = await prisma.delivery.findMany({
          where: { assignedDriverId: driverId, status: { in: ['PENDING', 'IN_TRANSIT', 'DELAYED'] } },
        });

        const driverState = simulator.getDriverState(driverId);
        const routes = await optimizeRoutes(
          { lat: process.env.DEPOT_LAT || 40.7128, lng: process.env.DEPOT_LNG || -74.0060 },
          [{ id: driverId, lat: driverState?.lat || driver.currentLat, lng: driverState?.lng || driver.currentLng }],
          deliveries.map(d => ({ id: d.id, lat: d.destinationLat, lng: d.destinationLng }))
        );

        if (routes[0]) {
          simulator.assignRoute(driverId, routes[0].polyline, 'BUSY');
          await prisma.driver.update({ where: { id: driverId }, data: { status: 'BUSY' } });
          await prisma.routeHistory.create({
            data: { driverId, routePolyline: routes[0].polyline },
          });
          routeUpdates.push(routes[0]);
        }
      }

      // Emit updates to all clients
      io.emit('route_update', routeUpdates);
      emitChaosEvent({
        type: 'MANUAL_REASSIGN',
        message: `📦 Package #${packageId} manually reassigned to Driver #${newDriverId}.`,
        affectedDeliveryId: packageId,
        affectedDriverId: newDriverId,
      });

      const kpis = await computeKPIs();
      io.emit('kpi_update', kpis);

    } catch (err) {
      console.error('[Socket] manual_reassign error:', err.message);
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
}

module.exports = { registerHandlers };
