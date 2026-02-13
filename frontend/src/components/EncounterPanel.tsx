import type { EncounterSummary } from '../types'
import './EncounterPanel.css'

const DETECTION_RADIUS_KM = 10

interface EncounterPanelProps {
  encounters: EncounterSummary[]
  selectedId: number | null
  onSelect: (id: number | null) => void
  isCollapsed: boolean
  onToggle: () => void
}

// Convert feet to meters
function feetToMeters(feet: number): number {
  return Math.round(feet * 0.3048)
}

export function EncounterPanel({ encounters, selectedId, onSelect, isCollapsed, onToggle }: EncounterPanelProps) {
  const formatTime = (ts: number) => {
    const date = new Date(ts * 1000)
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Active'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  if (isCollapsed) {
    return (
      <button className="panel-toggle left" onClick={onToggle} title="Show Encounters">
        <span>⚙</span>
        <span className="toggle-count">{encounters.length}</span>
      </button>
    )
  }

  return (
    <aside className="encounter-panel">
      <div className="panel-header">
        <h2>
          <span className="panel-icon">⚙</span>
          Encounter Log
        </h2>
        <button className="collapse-btn" onClick={onToggle} title="Hide Panel">←</button>
        <div className="encounter-count">{encounters.length} Records</div>
      </div>

      <div className="encounter-list">
        {encounters.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <p>No encounters detected</p>
            <small>Aircraft within {DETECTION_RADIUS_KM}km radius will appear here</small>
          </div>
        ) : (
          encounters.map(enc => {
            const minAltM = enc.min_alt ? feetToMeters(enc.min_alt) : null
            const maxAltM = enc.max_alt ? feetToMeters(enc.max_alt) : null
            
            return (
              <div
                key={enc.id}
                className={`encounter-card ${enc.is_active ? 'active' : ''} ${selectedId === enc.id ? 'selected' : ''}`}
                onClick={() => onSelect(selectedId === enc.id ? null : enc.id)}
              >
                <div className="encounter-header">
                  <span className="encounter-flight">{enc.flight || 'UNKNOWN'}</span>
                  <span className={`encounter-status ${enc.is_active ? 'active' : 'closed'}`}>
                    {enc.is_active ? '● ACTIVE' : '○ CLOSED'}
                  </span>
                </div>

                <div className="encounter-hex">{enc.hex}</div>

                <div className="encounter-stats">
                  <div className="stat">
                    <label>Start</label>
                    <span className="stat-value">{formatTime(enc.start_ts)}</span>
                  </div>
                  <div className="stat">
                    <label>Duration</label>
                    <span className="stat-value">{formatDuration(enc.duration_seconds)}</span>
                  </div>
                  <div className="stat">
                    <label>Min Dist</label>
                    <span className="stat-value">{enc.min_dist.toFixed(1)} km</span>
                  </div>
                </div>

                <div className="encounter-altitude">
                  <span>Altitude: </span>
                  {enc.min_alt !== null ? (
                    <>
                      {enc.min_alt.toLocaleString()} - {enc.max_alt?.toLocaleString()} ft
                      <span className="metric">
                        ({minAltM?.toLocaleString()} - {maxAltM?.toLocaleString()} m)
                      </span>
                    </>
                  ) : (
                    'N/A'
                  )}
                </div>

                <div className="encounter-points">
                  {enc.point_count} trackpoints
                </div>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}