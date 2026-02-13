import type { LiveAircraft } from '../types'
import './AircraftPanel.css'

const DETECTION_RADIUS_KM = 10

interface AircraftPanelProps {
  aircraft: LiveAircraft[]
  isCollapsed: boolean
  onToggle: () => void
}

// Convert feet to meters
function feetToMeters(feet: number): number {
  return Math.round(feet * 0.3048)
}

export function AircraftPanel({ aircraft, isCollapsed, onToggle }: AircraftPanelProps) {
  if (isCollapsed) {
    const inRange = aircraft.filter(a => a.distance_km <= DETECTION_RADIUS_KM).length
    return (
      <button className="panel-toggle right" onClick={onToggle} title="Show Aircraft">
        <span>📡</span>
        <span className="toggle-count">{inRange}</span>
      </button>
    )
  }

  return (
    <aside className="aircraft-panel">
      <div className="panel-header">
        <h2>
          <span className="panel-icon">📡</span>
          Live Aircraft
        </h2>
        <button className="collapse-btn" onClick={onToggle} title="Hide Panel">→</button>
        <div className="aircraft-count">
          {aircraft.filter(a => a.distance_km <= DETECTION_RADIUS_KM).length} in range
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
            .map(ac => {
              const altMeters = ac.altitude ? feetToMeters(ac.altitude) : null
              const isInZone = ac.distance_km <= DETECTION_RADIUS_KM
              
              return (
                <div
                  key={ac.hex}
                  className={`aircraft-card ${isInZone ? 'in-zone' : ''}`}
                >
                  <div className="aircraft-header">
                    <span className="aircraft-flight">{ac.flight || 'UNKNOWN'}</span>
                    <span className={`distance-badge ${isInZone ? 'close' : ''}`}>
                      {ac.distance_km.toFixed(1)} km
                    </span>
                  </div>

                  <div className="aircraft-hex">{ac.hex}</div>

                  <div className="aircraft-data">
                    <div className="data-row">
                      <span className="data-label">Altitude</span>
                      <span className="data-value">
                        {ac.altitude ? (
                          <>
                            {ac.altitude.toLocaleString()} ft
                            <span className="metric">
                              ({altMeters?.toLocaleString()} m)
                            </span>
                          </>
                        ) : 'N/A'}
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
              )
            })
        )}
      </div>
    </aside>
  )
}