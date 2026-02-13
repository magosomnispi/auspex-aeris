import './StatusBar.css'

interface StatusBarProps {
  aircraftCount: number
  encounterCount: number
  lastPoll?: number
}

export function StatusBar({ aircraftCount, encounterCount, lastPoll }: StatusBarProps) {
  const getLastPollText = () => {
    if (!lastPoll) return 'Never'
    const seconds = Math.floor((Date.now() - lastPoll) / 1000)
    if (seconds < 1) return 'Just now'
    if (seconds < 60) return `${seconds}s ago`
    return `${Math.floor(seconds / 60)}m ago`
  }

  return (
    <footer className="status-bar">
      <div className="status-left">
        <div className="status-item">
          <span className="status-label">Aircraft Tracked</span>
          <span className="status-value">{aircraftCount}</span>
        </div>
        <div className="status-divider"></div>
        <div className="status-item">
          <span className="status-label">Encounters Logged</span>
          <span className="status-value">{encounterCount}</span>
        </div>
      </div>

      <div className="status-center">
        <div className="omnisiah-seal">
          <span className="cog-small">⚙</span>
          <span className="seal-text">OMNISSIAH PROTECTS</span>
          <span className="cog-small">⚙</span>
        </div>
      </div>

      <div className="status-right">
        <div className="status-item">
          <span className="status-label">Last Poll</span>
          <span className="status-value poll-time">{getLastPollText()}</span>
        </div>
        <div className="status-divider"></div>
        <div className="status-item">
          <span className="status-label">System</span>
          <span className="status-value system-ok">OPERATIONAL</span>
        </div>
      </div>
    </footer>
  )
}