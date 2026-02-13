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

export interface SystemStatus {
  ok: boolean;
  service: string;
  version: string;
  poller: {
    is_running: boolean;
    last_poll: number;
    errors: number;
    servitor_url: string;
    aircraft_count: number;
  };
  timestamp: number;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: [number, number, number | null][];
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