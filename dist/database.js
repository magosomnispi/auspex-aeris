import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
const DATA_DIR = process.env.DATA_DIR || '/var/lib/auspex-monitor';
const ENCOUNTERS_FILE = join(DATA_DIR, 'encounters.json');
const TRACKPOINTS_FILE = join(DATA_DIR, 'trackpoints.json');
// Ensure directory exists
try {
    mkdirSync(DATA_DIR, { recursive: true });
}
catch (e) {
    // Directory may already exist
}
// In-memory storage
let encounters = [];
let trackpoints = [];
let nextEncounterId = 1;
let nextTrackpointId = 1;
// Session-only ephemeral tracking (not persisted)
const sessionTracks = new Map();
const MAX_SESSION_POINTS = 500; // Max points per aircraft in session
const MAX_SESSION_AGE = 3600; // Remove aircraft not seen for 1 hour
// Load from disk if exists
function loadData() {
    try {
        if (existsSync(ENCOUNTERS_FILE)) {
            const data = JSON.parse(readFileSync(ENCOUNTERS_FILE, 'utf8'));
            encounters = data.encounters || [];
            nextEncounterId = data.nextId || 1;
        }
        if (existsSync(TRACKPOINTS_FILE)) {
            const data = JSON.parse(readFileSync(TRACKPOINTS_FILE, 'utf8'));
            trackpoints = data.trackpoints || [];
            nextTrackpointId = data.nextId || 1;
        }
        console.log(`[DATABASE] Loaded ${encounters.length} encounters, ${trackpoints.length} trackpoints`);
    }
    catch (e) {
        console.log('[DATABASE] Starting with fresh data');
    }
}
// Save to disk
function saveData() {
    try {
        writeFileSync(ENCOUNTERS_FILE, JSON.stringify({
            encounters,
            nextId: nextEncounterId
        }, null, 2));
        writeFileSync(TRACKPOINTS_FILE, JSON.stringify({
            trackpoints,
            nextId: nextTrackpointId
        }, null, 2));
    }
    catch (e) {
        console.error('[DATABASE] Error saving data:', e);
    }
}
// Initialize
export function initSchema() {
    loadData();
    console.log('[DATABASE] JSON storage initialized');
    // Auto-save every 30 seconds
    setInterval(saveData, 30000);
    // Cleanup old session tracks every 5 minutes
    setInterval(cleanupSessionTracks, 300000);
}
// Cleanup old session tracks
function cleanupSessionTracks() {
    const now = Date.now() / 1000;
    let count = 0;
    for (const [hex, track] of sessionTracks.entries()) {
        if (now - track.lastUpdate > MAX_SESSION_AGE) {
            sessionTracks.delete(hex);
            count++;
        }
    }
    if (count > 0) {
        console.log(`[SESSION] Cleaned up ${count} stale aircraft tracks`);
    }
}
// Haversine distance calculation (km)
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
const CENTER_LAT = 59.257888;
const CENTER_LON = 18.198243;
export class DatabaseManager {
    // Track all aircraft in session (ephemeral)
    trackAircraft(aircraft) {
        if (!aircraft.lat || !aircraft.lon)
            return;
        const now = Date.now() / 1000;
        const alt = aircraft.altitude ?? aircraft.alt_baro ?? null;
        let track = sessionTracks.get(aircraft.hex);
        if (!track) {
            track = {
                hex: aircraft.hex,
                flight: aircraft.flight?.trim() || null,
                points: [],
                firstSeen: now,
                lastUpdate: now
            };
            sessionTracks.set(aircraft.hex, track);
        }
        // Add point every 2 seconds max
        const lastPoint = track.points[track.points.length - 1];
        if (!lastPoint || (now - lastPoint.ts) >= 2.0) {
            track.points.push({
                ts: now,
                lat: aircraft.lat,
                lon: aircraft.lon,
                alt,
                gs: aircraft.gs ?? null,
                track: aircraft.track ?? null
            });
            track.lastUpdate = now;
            track.flight = aircraft.flight?.trim() || track.flight;
            // Limit points to prevent memory bloat
            if (track.points.length > MAX_SESSION_POINTS) {
                track.points.shift();
            }
        }
    }
    // Get session track for an aircraft
    getSessionTrack(hex) {
        return sessionTracks.get(hex) || null;
    }
    // Get all session tracks (for display)
    getAllSessionTracks() {
        return Array.from(sessionTracks.values());
    }
    // Check if aircraft is within range and manage encounters
    processAircraft(aircraft) {
        if (!aircraft.lat || !aircraft.lon)
            return;
        const distance = haversine(CENTER_LAT, CENTER_LON, aircraft.lat, aircraft.lon);
        const now = Date.now() / 1000;
        const alt = aircraft.altitude ?? aircraft.alt_baro ?? null;
        // Track all aircraft in session
        this.trackAircraft(aircraft);
        // Find existing active encounter
        const existing = encounters.find(e => e.hex === aircraft.hex && e.is_active === 1);
        if (distance <= 10.0) {
            // Inside zone - save to persistent storage
            if (existing) {
                // Update existing encounter
                existing.end_ts = now;
                existing.min_dist = Math.min(existing.min_dist, distance);
                if (alt !== null) {
                    existing.min_alt = existing.min_alt === null ? alt : Math.min(existing.min_alt, alt);
                    existing.max_alt = existing.max_alt === null ? alt : Math.max(existing.max_alt, alt);
                }
                // Add trackpoint every 5 seconds
                const lastPoint = trackpoints
                    .filter(t => t.encounter_id === existing.id)
                    .sort((a, b) => b.ts - a.ts)[0];
                if (!lastPoint || (now - lastPoint.ts) >= 5.0) {
                    trackpoints.push({
                        id: nextTrackpointId++,
                        encounter_id: existing.id,
                        ts: now,
                        lat: aircraft.lat,
                        lon: aircraft.lon,
                        alt,
                        gs: aircraft.gs ?? null,
                        track: aircraft.track ?? null
                    });
                }
            }
            else {
                // Start new encounter
                const encounter = {
                    id: nextEncounterId++,
                    hex: aircraft.hex,
                    flight: aircraft.flight?.trim() || null,
                    start_ts: now,
                    end_ts: now,
                    min_dist: distance,
                    min_alt: alt,
                    max_alt: alt,
                    is_active: 1
                };
                encounters.push(encounter);
                // Add first trackpoint
                trackpoints.push({
                    id: nextTrackpointId++,
                    encounter_id: encounter.id,
                    ts: now,
                    lat: aircraft.lat,
                    lon: aircraft.lon,
                    alt,
                    gs: aircraft.gs ?? null,
                    track: aircraft.track ?? null
                });
                console.log(`[ENCOUNTER] Started #${encounter.id} for ${aircraft.hex} (${aircraft.flight?.trim() || 'unknown'}) at ${distance.toFixed(2)}km`);
            }
        }
        else {
            // Outside zone - check if we should close encounter
            if (existing) {
                const lastPoint = trackpoints
                    .filter(t => t.encounter_id === existing.id)
                    .sort((a, b) => b.ts - a.ts)[0];
                if (lastPoint && (now - lastPoint.ts) >= 60.0) {
                    existing.is_active = 0;
                    console.log(`[ENCOUNTER] Closed #${existing.id} for ${aircraft.hex}`);
                }
            }
        }
    }
    // Clean up stale encounters
    cleanupStaleEncounters() {
        const now = Date.now() / 1000;
        let count = 0;
        encounters.forEach(e => {
            if (e.is_active === 1) {
                const lastPoint = trackpoints
                    .filter(t => t.encounter_id === e.id)
                    .sort((a, b) => b.ts - a.ts)[0];
                if (!lastPoint || (now - lastPoint.ts) >= 300) {
                    e.is_active = 0;
                    e.end_ts = now;
                    count++;
                }
            }
        });
        if (count > 0) {
            console.log(`[CLEANUP] Closed ${count} stale encounter(s)`);
            saveData();
        }
        return count;
    }
    // Get encounter summaries
    getEncounters(limit = 100, offset = 0) {
        const sorted = [...encounters].sort((a, b) => b.start_ts - a.start_ts);
        const page = sorted.slice(offset, offset + limit);
        return page.map(e => ({
            ...e,
            is_active: Boolean(e.is_active),
            duration_seconds: e.end_ts && e.end_ts > e.start_ts ? e.end_ts - e.start_ts : null,
            point_count: trackpoints.filter(t => t.encounter_id === e.id).length
        }));
    }
    // Get single encounter with trackpoints
    getEncounter(id) {
        const encounter = encounters.find(e => e.id === id);
        if (!encounter)
            return null;
        const pts = trackpoints
            .filter(t => t.encounter_id === id)
            .sort((a, b) => a.ts - b.ts);
        return { encounter, trackpoints: pts };
    }
    // Get session track as GeoJSON for any aircraft
    getSessionTrackGeoJson(hex) {
        const track = sessionTracks.get(hex);
        if (!track || track.points.length === 0)
            return null;
        const coords = track.points.map(p => [p.lon, p.lat, p.alt]);
        // Check if this aircraft has a saved encounter
        const hasEncounter = encounters.some(e => e.hex === hex);
        const feature = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coords
            },
            properties: {
                hex: track.hex,
                flight: track.flight,
                start_ts: track.firstSeen,
                end_ts: track.lastUpdate,
                is_session_track: true,
                has_persistent_encounter: hasEncounter
            }
        };
        return {
            feature,
            properties: {
                point_count: track.points.length,
                is_encounter: hasEncounter
            }
        };
    }
    // Get encounter as GeoJSON
    getEncounterGeoJson(id) {
        const data = this.getEncounter(id);
        if (!data || data.trackpoints.length === 0)
            return null;
        const coords = data.trackpoints.map(tp => [tp.lon, tp.lat, tp.alt]);
        const feature = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coords
            },
            properties: {
                hex: data.encounter.hex,
                flight: data.encounter.flight,
                start_ts: data.encounter.start_ts,
                end_ts: data.encounter.end_ts,
                min_alt: data.encounter.min_alt,
                max_alt: data.encounter.max_alt,
                min_dist: data.encounter.min_dist,
                is_session_track: false
            }
        };
        return { feature, properties: { point_count: data.trackpoints.length } };
    }
    // Get stats
    getStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTs = today.getTime() / 1000;
        return {
            total_encounters: encounters.length,
            active_encounters: encounters.filter(e => e.is_active === 1).length,
            total_trackpoints: trackpoints.length,
            today_encounters: encounters.filter(e => e.start_ts >= todayTs).length,
            session_aircraft: sessionTracks.size
        };
    }
    // Force save
    save() {
        saveData();
    }
}
//# sourceMappingURL=database.js.map