const express = require('express');
const router = express.Router();
const prisma = require('../db');

// GET /api/deliveries
router.get('/', async (req, res) => {
  try {
    const deliveries = await prisma.delivery.findMany({
      include: { assignedDriver: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/deliveries/:id — update status
router.patch('/:id', async (req, res) => {
  const { status, assignedDriverId } = req.body;
  try {
    const updated = await prisma.delivery.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(status && { status }),
        ...(assignedDriverId !== undefined && { assignedDriverId }),
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
