const express = require('express');
const router = express.Router();
const { optimizeRoutes } = require('../services/routeOptimizer');

/**
 * POST /api/route/optimize
 * Body: { depotLat, depotLng, drivers: [{id, lat, lng}], deliveries: [{id, lat, lng}] }
 * Returns: { assignments: [{ driverId, orderedStops, polyline }] }
 */
router.post('/optimize', async (req, res) => {
  const { depotLat, depotLng, drivers, deliveries } = req.body;

  if (!drivers || !deliveries) {
    return res.status(400).json({ error: 'drivers and deliveries are required.' });
  }

  try {
    const depot = {
      lat: depotLat || parseFloat(process.env.DEPOT_LAT) || 40.7128,
      lng: depotLng || parseFloat(process.env.DEPOT_LNG) || -74.0060,
    };
    const assignments = await optimizeRoutes(depot, drivers, deliveries);
    res.json({ assignments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
