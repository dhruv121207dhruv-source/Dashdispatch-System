require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const prisma = require('./db');
const simulator = require('./services/driverSimulator');
const incidentEngine = require('./services/incidentEngine');
const { registerHandlers } = require('./socket/handlers');

const driversRouter = require('./routes/drivers');
const deliveriesRouter = require('./routes/deliveries');
const routeRouter = require('./routes/route');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── REST Routes ─────────────────────────────────────────────
app.use('/api/drivers', driversRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/route', routeRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── WebSocket ───────────────────────────────────────────────
io.on('connection', (socket) => registerHandlers(io, socket));

// ── Boot Sequence ────────────────────────────────────────────
async function boot() {
  try {
    await prisma.$connect();
    console.log('[Server] ✅ Connected to MySQL via Prisma.');

    // Init services with socket reference
    simulator.init(io);
    incidentEngine.init(io);

    // Load driver positions from DB into memory
    await simulator.loadDriversFromDB();

    // Start background services
    simulator.start();
    incidentEngine.start();

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`[Server] 🚀 Dispatch backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] ❌ Failed to start:', err.message);
    process.exit(1);
  }
}

boot();
