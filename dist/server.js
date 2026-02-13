import express from 'express';
import cors from 'cors';
import { DatabaseManager, initSchema } from './database.js';
import { Poller } from './poller.js';
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
// Initialize database
initSchema();
const db = new DatabaseManager();
// Initialize poller
const poller = new Poller(db);
// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
// Request logging
app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
});
// Health check
app.get('/health', (req, res) => {
    const status = poller.getStatus();
    res.json({
        ok: true,
        service: 'auspex-monitor',
        version: '1.0.0',
        poller: status,
        timestamp: Date.now()
    });
});
// Live aircraft (current snapshot)
app.get('/api/live', (req, res) => {
    const aircraft = poller.getCurrentAircraft();
    res.json({
        ok: true,
        now: Date.now() / 1000,
        count: aircraft.length,
        aircraft
    });
});
// All encounters (paginated)
app.get('/api/encounters', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);
    try {
        const encounters = db.getEncounters(limit, offset);
        res.json({
            ok: true,
            count: encounters.length,
            encounters
        });
    }
    catch (error) {
        console.error('[API] Error fetching encounters:', error);
        res.status(503).json({
            ok: false,
            error: 'Database error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Single encounter
app.get('/api/encounters/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ ok: false, error: 'Invalid encounter ID' });
    }
    try {
        const data = db.getEncounter(id);
        if (!data) {
            return res.status(404).json({ ok: false, error: 'Encounter not found' });
        }
        res.json({
            ok: true,
            encounter: data.encounter,
            trackpoints: data.trackpoints,
            point_count: data.trackpoints.length
        });
    }
    catch (error) {
        console.error('[API] Error fetching encounter:', error);
        res.status(503).json({
            ok: false,
            error: 'Database error'
        });
    }
});
// Encounter as GeoJSON
app.get('/api/encounters/:id/geojson', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ ok: false, error: 'Invalid encounter ID' });
    }
    try {
        const data = db.getEncounterGeoJson(id);
        if (!data) {
            return res.status(404).json({ ok: false, error: 'Encounter not found or has no track' });
        }
        res.json({
            ok: true,
            type: 'FeatureCollection',
            features: [data.feature],
            properties: data.properties
        });
    }
    catch (error) {
        console.error('[API] Error generating GeoJSON:', error);
        res.status(503).json({
            ok: false,
            error: 'Database error'
        });
    }
});
// Stats
app.get('/api/stats', (req, res) => {
    try {
        const stats = db.getStats();
        res.json({
            ok: true,
            stats
        });
    }
    catch (error) {
        console.error('[API] Error fetching stats:', error);
        res.status(503).json({
            ok: false,
            error: 'Database error'
        });
    }
});
// Root
app.get('/', (req, res) => {
    res.json({
        ok: true,
        service: 'AUSPEX AERIS MONITOR',
        version: '1.0.0',
        endpoints: [
            '/health',
            '/api/live',
            '/api/encounters',
            '/api/encounters/:id',
            '/api/encounters/:id/geojson',
            '/api/stats'
        ],
        center: { lat: 59.257888, lon: 18.198243 }
    });
});
// Error handling
app.use((err, req, res, next) => {
    console.error('[API] Unhandled error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
});
// 404
app.use((req, res) => {
    res.status(404).json({ ok: false, error: 'Endpoint not found', path: req.path });
});
// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('═══════════════════════════════════════════');
    console.log('  AUSPEX AERIS MONITOR v1.0.0');
    console.log('  Mechanicus Flight Tracking Sanctum');
    console.log('═══════════════════════════════════════════');
    console.log(`[SERVER] Running on http://0.0.0.0:${PORT}`);
    console.log(`[CORS] Origin: ${CORS_ORIGIN}`);
    console.log(`[DATABASE] Path: ${process.env.DB_PATH || '/var/lib/auspex-monitor/flights.db'}`);
    // Start polling
    poller.start();
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[SERVER] SIGTERM received, shutting down gracefully');
    poller.stop();
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('[SERVER] SIGINT received, shutting down gracefully');
    poller.stop();
    process.exit(0);
});
//# sourceMappingURL=server.js.map