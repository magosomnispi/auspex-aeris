import { DatabaseManager } from './database.js';
import { Dump1090Data, LiveAircraft } from './types.js';
import cron from 'node-cron';

const SERVITOR_URL = process.env.DUMP1090_API || 'http://192.168.68.120:3000';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '1', 10);

const CENTER_LAT = 59.257888;
const CENTER_LON = 18.198243;

let currentAircraft: LiveAircraft[] = [];
let lastPollTime = 0;
let pollErrors = 0;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export class Poller {
  private db: DatabaseManager;
  private isRunning = false;

  constructor(dbManager: DatabaseManager) {
    this.db = dbManager;
  }

  async poll(): Promise<void> {
    try {
      const response = await fetch(`${SERVITOR_URL}/adsb/aircraft`, { 
        signal: AbortSignal.timeout(5000) 
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as Dump1090Data;
      lastPollTime = Date.now();
      pollErrors = 0;
      
      // Process aircraft
      const live: LiveAircraft[] = [];
      
      for (const ac of data.aircraft) {
        if (ac.lat && ac.lon) {
          const distance = haversine(CENTER_LAT, CENTER_LON, ac.lat, ac.lon);
          const alt = ac.altitude ?? ac.alt_baro ?? null;
          
          live.push({
            hex: ac.hex,
            flight: ac.flight?.trim() || null,
            lat: ac.lat,
            lon: ac.lon,
            altitude: alt,
            gs: ac.gs ?? null,
            track: ac.track ?? null,
            distance_km: parseFloat(distance.toFixed(2)),
            seen_seconds: ac.seen ?? 0
          });
          
          // Process for encounter tracking (only within 10km to reduce noise)
          if (distance <= 10.0) {
            this.db.processAircraft(ac);
          }
        }
      }
      
      // Sort by distance
      live.sort((a, b) => a.distance_km - b.distance_km);
      currentAircraft = live;
      
    } catch (error) {
      pollErrors++;
      console.error(`[POLLER] Error (attempt ${pollErrors}):`, error instanceof Error ? error.message : String(error));
    }
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log(`[POLLER] Starting - polling every ${POLL_INTERVAL}s from ${SERVITOR_URL}`);
    
    // Immediate first poll
    this.poll();
    
    // Schedule recurring polls
    const task = cron.schedule(`*/${POLL_INTERVAL} * * * * *`, () => {
      this.poll();
    }, { scheduled: true });
    
    // Cleanup stale encounters every minute
    cron.schedule('*/1 * * * *', () => {
      this.db.cleanupStaleEncounters();
    }, { scheduled: true });
  }

  stop(): void {
    this.isRunning = false;
  }

  getStatus(): {
    is_running: boolean;
    last_poll: number;
    errors: number;
    servitor_url: string;
    aircraft_count: number;
  } {
    return {
      is_running: this.isRunning,
      last_poll: lastPollTime,
      errors: pollErrors,
      servitor_url: SERVITOR_URL,
      aircraft_count: currentAircraft.length
    };
  }

  getCurrentAircraft(): LiveAircraft[] {
    return currentAircraft;
  }
}

export { currentAircraft };