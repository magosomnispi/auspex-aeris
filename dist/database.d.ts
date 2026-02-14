import { Encounter, Trackpoint, EncounterSummary, SessionTrack } from './types.js';
interface DistanceRecord {
    hex: string;
    flight: string | null;
    distance_km: number;
    lat: number;
    lon: number;
    altitude: number | null;
    timestamp: number;
    gs: number | null;
    track: number | null;
    baro_rate: number | null;
    mach: number | null;
    tas: number | null;
    ias: number | null;
    nav_altitude_mcp: number | null;
    nav_qnh: number | null;
    nav_heading: number | null;
    seen: number | null;
    rssi: number | null;
    messages: number | null;
    positions_tracked: number;
    tracking_duration_seconds: number;
    first_seen: number;
    set_at: number;
}
export declare function initSchema(): void;
export declare class DatabaseManager {
    trackAircraft(aircraft: {
        hex: string;
        flight?: string;
        lat?: number;
        lon?: number;
        altitude?: number;
        alt_baro?: number;
        gs?: number;
        track?: number;
        baro_rate?: number;
        mach?: number;
        tas?: number;
        ias?: number;
        nav_altitude_mcp?: number;
        nav_qnh?: number;
        nav_heading?: number;
        seen?: number;
        rssi?: number;
        messages?: number;
    }, distance_km: number): void;
    private checkDistanceRecord;
    getDistanceRecord(): DistanceRecord | null;
    cleanupRecordCandidates(): number;
    getSessionTrack(hex: string): SessionTrack | null;
    getAllSessionTracks(): SessionTrack[];
    processAircraft(aircraft: {
        hex: string;
        flight?: string;
        lat?: number;
        lon?: number;
        altitude?: number;
        alt_baro?: number;
        gs?: number;
        track?: number;
        seen?: number;
        baro_rate?: number;
        mach?: number;
        tas?: number;
        ias?: number;
        nav_altitude_mcp?: number;
        nav_qnh?: number;
        nav_heading?: number;
        rssi?: number;
        messages?: number;
    }): void;
    cleanupStaleEncounters(): number;
    getEncounters(limit?: number, offset?: number): EncounterSummary[];
    getEncounter(id: number): {
        encounter: Encounter;
        trackpoints: Trackpoint[];
    } | null;
    getSessionTrackGeoJson(hex: string): {
        feature: Record<string, unknown>;
        properties: {
            point_count: number;
            is_encounter: boolean;
        };
    } | null;
    getEncounterGeoJson(id: number): {
        feature: Record<string, unknown>;
        properties: {
            point_count: number;
        };
    } | null;
    getStats(): {
        total_encounters: number;
        active_encounters: number;
        total_trackpoints: number;
        today_encounters: number;
        session_aircraft: number;
        distance_record: DistanceRecord | null;
    };
    save(): void;
}
export {};
//# sourceMappingURL=database.d.ts.map