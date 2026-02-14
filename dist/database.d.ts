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
    }, distance_km: number): void;
    private checkDistanceRecord;
    getDistanceRecord(): DistanceRecord | null;
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