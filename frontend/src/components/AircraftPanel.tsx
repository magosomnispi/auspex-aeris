import type { LiveAircraft } from '../types'
import './AircraftPanel.css'

interface AircraftPanelProps {
  aircraft: LiveAircraft[]
}

export function AircraftPanel({ aircraft }: AircraftPanelProps) {
  return (
    <aside className="aircraft-panel">
      <div className="panel-header">
        <h2>
          <span className="panel-icon">📡</span>
          Live Aircraft
        </h2>
        <div className="aircraft-count">
          {aircraft.filter(a => a.distance_km <= 10).length} in range
        </div>
      </div>

      <div className="aircraft-list">
        {aircraft.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✈</div>
            <p>No aircraft detected</p>
            <small>Scanning airspace...</small>
          </div>
        ) : (
          aircraft
            .sort((a, b) => a.distance_km - b.distance_km)
            .map(ac => (
              <div
                key={ac.hex}
                className={`aircraft-card ${ac.distance_km <= 5 ? 'in-zone' : ''}`}
              >
                <div className="aircraft-header">
                  <span className="aircraft-flight">{ac.flight || 'UNKNOWN'}</span>
                  <span className={`distance-badge ${ac.distance_km <= 5 ? 'close' : ''}`}>
                    {ac.distance_km.toFixed(1)} km
                  </span>
                </div>

                <div className="aircraft-hex">{ac.hex}</div>

                <div className="aircraft-data">
                  <div className="data-row">
                    <span className="data-label">Altitude</span>
                    <span className="data-value">
                      {ac.altitude ? `${ac.altitude.toLocaleString()} ft` : 'N/A'}
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Speed</span>
                    <span className="data-value">
                      {ac.gs ? `${ac.gs.toFixed(0)} kt` : 'N/A'}
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Track</span>
                    <span className="data-value">
                      {ac.track ? `${ac.track.toFixed(0)}°` : 'N/A'}
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Last seen</span>
                    <span className="data-value">{ac.seen_seconds.toFixed(0)}s</span>
                  </div>
                </div>

                <div className="coordinates">
                  {ac.lat.toFixed(4)}°N, {ac.lon.toFixed(4)}°E
                </div>
              </div>
            ))
        )}
      </div>
    </aside>
  )
}