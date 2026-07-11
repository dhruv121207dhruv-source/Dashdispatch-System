const express = require('express');
const router = express.Router();
const prisma = require('../db');

// GET /api/drivers — return all drivers with current positions
router.get('/', async (req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      include: {
        deliveries: {
          where: { status: { in: ['PENDING', 'IN_TRANSIT', 'DELAYED'] } },
          select: { id: true, status: true, destinationLat: true, destinationLng: true, label: true },
        },
      },
    });
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
