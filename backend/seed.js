/**
 * Seed Script
 * Creates 5 drivers and 20 deliveries in the MySQL database.
 * Run: node seed.js
 */

require('dotenv').config();
const prisma = require('./src/db');
const { optimizeRoutes } = require('./src/services/routeOptimizer');

const DEPOT_LAT = parseFloat(process.env.DEPOT_LAT) || 40.7128;
const DEPOT_LNG = parseFloat(process.env.DEPOT_LNG) || -74.0060;

const DRIVER_NAMES = ['Alex Rivera', 'Jordan Chen', 'Sam Patel', 'Morgan Lee', 'Taylor Brooks'];
const NEIGHBORHOODS = [
  'Times Square', 'Brooklyn Bridge', 'Central Park', 'Harlem', 'SOHO',
  'Chinatown', 'Greenwich Village', 'Upper East Side', 'Bronx', 'Queens',
  'Jersey City', 'Flushing', 'Astoria', 'Long Island City', 'Williamsburg',
  'Park Slope', 'Bushwick', 'Crown Heights', 'Bay Ridge', 'Flatbush',
];

// Random offset within ~8km of depot
function randOffset(range = 0.07) {
  return (Math.random() - 0.5) * 2 * range;
}

async function seed() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.routeHistory.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.driver.deleteMany();
  console.log('   Cleared existing records.');

  // Create drivers near depot
  const drivers = await Promise.all(
    DRIVER_NAMES.map((name, i) =>
      prisma.driver.create({
        data: {
          name,
          currentLat: DEPOT_LAT + randOffset(0.01),
          currentLng: DEPOT_LNG + randOffset(0.01),
          status: 'AVAILABLE',
        },
      })
    )
  );
  console.log(`   Created ${drivers.length} drivers.`);

  // Create 20 deliveries
  const deliveries = await Promise.all(
    NEIGHBORHOODS.map((label, i) =>
      prisma.delivery.create({
        data: {
          label,
          destinationLat: DEPOT_LAT + randOffset(0.07),
          destinationLng: DEPOT_LNG + randOffset(0.07),
          status: 'PENDING',
          assignedDriverId: drivers[i % drivers.length].id,
        },
      })
    )
  );
  console.log(`   Created ${deliveries.length} deliveries.`);

  // Optimize initial routes and save route histories
  console.log('   Optimizing initial routes...');
  const depot = { lat: DEPOT_LAT, lng: DEPOT_LNG };
  const driverInputs = drivers.map(d => ({ id: d.id, lat: d.currentLat, lng: d.currentLng }));
  const deliveryInputs = deliveries.map(d => ({ id: d.id, lat: d.destinationLat, lng: d.destinationLng }));

  const routes = await optimizeRoutes(depot, driverInputs, deliveryInputs);

  for (const route of routes) {
    if (route.polyline.length > 0) {
      await prisma.routeHistory.create({
        data: { driverId: route.driverId, routePolyline: route.polyline },
      });
      await prisma.driver.update({
        where: { id: route.driverId },
        data: { status: route.orderedStops.length > 0 ? 'BUSY' : 'AVAILABLE' },
      });
    }
  }

  // Update first few deliveries to IN_TRANSIT for realism
  const transitIds = deliveries.slice(0, 10).map(d => d.id);
  await prisma.delivery.updateMany({ where: { id: { in: transitIds } }, data: { status: 'IN_TRANSIT' } });

  console.log('✅ Seed complete! Database is ready.');
  await prisma.$disconnect();
}

seed().catch(async (e) => {
  console.error('❌ Seed failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
