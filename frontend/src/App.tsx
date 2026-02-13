import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { Map } from './components/Map'
import { EncounterPanel } from './components/EncounterPanel'
import { AircraftPanel } from './components/AircraftPanel'
import { StatusBar } from './components/StatusBar'
import type { LiveAircraft, EncounterSummary, SystemStatus } from './types'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://192.168.68.114:3005'
const CENTER = { lat: 59.257888, lon: 18.198243 }

function App() {
  const [aircraft, setAircraft] = useState<LiveAircraft[]>([])
  const [encounters, setEncounters] = useState<EncounterSummary[]>([])
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [selectedEncounter, setSelectedEncounter] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Mobile panel collapse state
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      // Fetch live aircraft
      const liveRes = await fetch(`${API_BASE}/api/live`)
      if (liveRes.ok) {
        const liveData = await liveRes.json()
        setAircraft(liveData.aircraft || [])
      }

      // Fetch encounters
      const encRes = await fetch(`${API_BASE}/api/encounters?limit=50`)
      if (encRes.ok) {
        const encData = await encRes.json()
        setEncounters(encData.encounters || [])
      }

      // Fetch status
      const statusRes = await fetch(`${API_BASE}/health`)
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setStatus(statusData)
      }

      setError(null)
    } catch (err) {
      setError('Connection to sanctum lost')
      console.error('Fetch error:', err)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <div className="auspex-container">
      {/* Header */}
      <header className="auspex-header">
        <div className="header-left">
          <span className="cog-icon"></span>
          <h1>AUSPEX AERIS</h1>
          <span className="header-subtitle">Flight Monitoring Sanctum</span>
        </div>
        <div className="header-right">
          <div className={`status-indicator ${status?.poller.is_running ? 'active' : 'error'}`}>
            <span className="status-dot"></span>
            {status?.poller.is_running ? 'SANCTUM ACTIVE' : 'SANCTUM OFFLINE'}
          </div>
          {error && <div className="error-banner">{error}</div>}
        </div>
      </header>

      {/* Main Content */}
      <main className="auspex-main">
        {/* Left Panel - Encounters */}
        <EncounterPanel 
          encounters={encounters}
          selectedId={selectedEncounter}
          onSelect={setSelectedEncounter}
          isCollapsed={leftPanelCollapsed}
          onToggle={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
        />

        {/* Center - Map */}
        <div className="map-container">
          <Map 
            center={CENTER}
            aircraft={aircraft}
            selectedEncounter={selectedEncounter}
            apiBase={API_BASE}
          />
          <div className="map-overlay">
            <div className="coordinates">
              {CENTER.lat.toFixed(6)}°N  {CENTER.lon.toFixed(6)}°E
            </div>
            <div className="range-ring">10km Detection Radius</div>
          </div>
        </div>

        {/* Right Panel - Live Aircraft */}
        <AircraftPanel 
          aircraft={aircraft}
          isCollapsed={rightPanelCollapsed}
          onToggle={() => setRightPanelCollapsed(!rightPanelCollapsed)}
        />
      </main>

      {/* Footer */}
      <StatusBar 
        aircraftCount={aircraft.length}
        encounterCount={encounters.length}
        lastPoll={status?.poller.last_poll}
      />
    </div>
  )
}

export default App