import express from 'express';
import cors from 'cors';
import basicAuth from 'express-basic-auth';
import { DatabaseManager, initSchema } from './database.js';
import { Poller } from './poller.js';
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
// Authentication configuration
const AUTH_USER = process.env.AUTH_USER || 'inquisitor';
const AUTH_PASS = process.env.AUTH_PASS || 'Blackarmy1';
const AUTH_ENABLED = process.env.AUTH_ENABLED !== 'false';
// Initialize database
initSchema();
const db = new DatabaseManager();
// Initialize poller
const poller = new Poller(db);
// Middleware
app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
}));
app.use(express.json());
// Basic Authentication middleware
if (AUTH_ENABLED) {
    app.use(basicAuth({
        users: { [AUTH_USER]: AUTH_PASS },
        challenge: true,
        realm: 'AUSPEX AERIS SANCTUM'
    }));
    console.log(`[AUTH] Basic authentication enabled for user: ${AUTH_USER}`);
}
// Request logging
app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
});
// Health check (public)
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
// Distance record - farthest tracked aircraft
app.get('/api/record', (req, res) => {
    try {
        const record = db.getDistanceRecord();
        if (!record) {
            return res.status(404).json({
                ok: false,
                error: 'No record yet - awaiting first contact',
                message: 'Record will be set when an aircraft is tracked for at least 5 seconds'
            });
        }
        res.json({
            ok: true,
            record: {
                hex: record.hex,
                flight: record.flight,
                distance_km: record.distance_km,
                lat: record.lat,
                lon: record.lon,
                altitude: record.altitude,
                timestamp: record.timestamp,
                gs: record.gs,
                track: record.track,
                // Extended telemetry
                baro_rate: record.baro_rate,
                mach: record.mach,
                tas: record.tas,
                ias: record.ias,
                nav_altitude_mcp: record.nav_altitude_mcp,
                nav_qnh: record.nav_qnh,
                nav_heading: record.nav_heading,
                seen: record.seen,
                rssi: record.rssi,
                messages: record.messages,
                // Tracking metadata
                positions_tracked: record.positions_tracked,
                tracking_duration_seconds: record.tracking_duration_seconds,
                first_seen: record.first_seen,
                set_at: record.set_at,
                formatted: {
                    distance: `${record.distance_km.toFixed(2)} km`,
                    position: `${record.lat.toFixed(6)}°N, ${record.lon.toFixed(6)}°E`,
                    time: new Date(record.timestamp * 1000).toISOString(),
                    duration: `${record.tracking_duration_seconds}s`,
                    positions: record.positions_tracked
                }
            }
        });
    }
    catch (error) {
        console.error('[API] Error fetching record:', error);
        res.status(503).json({
            ok: false,
            error: 'Database error'
        });
    }
});
// Session tracks (ephemeral, not persisted)
app.get('/api/session-tracks', (req, res) => {
    try {
        const tracks = db.getAllSessionTracks();
        res.json({
            ok: true,
            count: tracks.length,
            tracks: tracks.map(t => ({
                hex: t.hex,
                flight: t.flight,
                firstSeen: t.firstSeen,
                lastUpdate: t.lastUpdate,
                pointCount: t.points.length
            }))
        });
    }
    catch (error) {
        console.error('[API] Error fetching session tracks:', error);
        res.status(503).json({
            ok: false,
            error: 'Database error'
        });
    }
});
// Single aircraft session track
app.get('/api/session-tracks/:hex', (req, res) => {
    const hex = req.params.hex.toLowerCase();
    try {
        const track = db.getSessionTrack(hex);
        if (!track) {
            return res.status(404).json({ ok: false, error: 'Aircraft not found in session' });
        }
        res.json({
            ok: true,
            hex: track.hex,
            flight: track.flight,
            firstSeen: track.firstSeen,
            lastUpdate: track.lastUpdate,
            points: track.points
        });
    }
    catch (error) {
        console.error('[API] Error fetching session track:', error);
        res.status(503).json({
            ok: false,
            error: 'Database error'
        });
    }
});
// Session track as GeoJSON (for map display)
app.get('/api/session-tracks/:hex/geojson', (req, res) => {
    const hex = req.params.hex.toLowerCase();
    try {
        const data = db.getSessionTrackGeoJson(hex);
        if (!data) {
            return res.status(404).json({ ok: false, error: 'Aircraft track not found or empty' });
        }
        res.json({
            ok: true,
            type: 'FeatureCollection',
            features: [data.feature],
            properties: data.properties
        });
    }
    catch (error) {
        console.error('[API] Error generating session track GeoJSON:', error);
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
            '/api/session-tracks',
            '/api/session-tracks/:hex',
            '/api/session-tracks/:hex/geojson',
            '/api/record',
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
    console.log(`[AUTH] ${AUTH_ENABLED ? 'Enabled' : 'Disabled'}`);
    if (AUTH_ENABLED) {
        console.log(`[AUTH] Username: ${AUTH_USER}`);
    }
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