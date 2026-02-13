/**
 * ADS-B Aircraft Data Structure from dump1090-fa
 */
export interface Aircraft {
  hex: string;
  flight?: string;
  lat?: number;
  lon?: number;
  altitude?: number;
  alt_baro?: number;
  alt_geom?: number;
  gs?: number;  // Ground speed
  track?: number;  // Heading
  squawk?: string;
  emergency?: string;
  category?: string;
  nav_qnh?: number;
  nav_altitude_mcp?: number;
  nav_heading?: number;
  nav_modes?: string[];
  nic?: number;
  rc?: number;
  version?: number;
  rssi?: number;
  dbm?: number;
  seen?: number;
  seen_pos?: number;
  messages?: number;
}

export interface Dump1090Data {
  now: number;
  messages: number;
  aircraft: Aircraft[];
}

export interface Encounter {
  id: number;
  hex: string;
  flight: string | null;
  start_ts: number;
  end_ts: number | null;
  min_dist: number;
  min_alt: number | null;
  max_alt: number | null;
  is_active: number;
}

export interface Trackpoint {
  id: number;
  encounter_id: number;
  ts: number;
  lat: number;
  lon: number;
  alt: number | null;
  gs: number | null;
  track: number | null;
}

export interface LiveAircraft {
  hex: string;
  flight: string | null;
  lat: number;
  lon: number;
  altitude: number | null;
  gs: number | null;
  track: number | null;
  distance_km: number;
  seen_seconds: number;
}

export interface EncounterSummary {
  id: number;
  hex: string;
  flight: string | null;
  start_ts: number;
  end_ts: number | null;
  duration_seconds: number | null;
  min_dist: number;
  min_alt: number | null;
  max_alt: number | null;
  is_active: boolean;
  point_count: number;
}

export interface GeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number, number | null][];  // [lon, lat, alt]
  };
  properties: {
    hex: string;
    flight: string | null;
    start_ts: number;
    end_ts: number | null;
    min_alt: number | null;
    max_alt: number | null;
    min_dist: number;
  };
}

export interface GeoJsonCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}