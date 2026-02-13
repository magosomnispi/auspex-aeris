# AUSPEX AERIS — Mechanicus Flight Monitoring Sanctum

*The Omnissiah sees all that flies within His domain.*

A Warhammer 40K-themed ADS-B flight tracking system with live map visualization and encounter logging.

## Architecture

```
┌─────────────────┐    HTTP    ┌──────────────────┐    HTTP    ┌─────────────────┐
│   dump1090-fa   │ ─────────→ │  ADS-B API       │ ─────────→ │  AUSPEX MONITOR │
│  (SERVITOR-A)   │            │  (Port 3000)     │            │  (Port 3005)    │
└─────────────────┘            └──────────────────┘            └────────┬────────┘
                                                                        │
                                                                        │ WebSocket/HTTP
                                                                        ↓
                                                               ┌─────────────────┐
                                                               │  React Frontend │
                                                               │  GitHub Pages   │
                                                               └─────────────────┘
```

## Backend API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Service status |
| `GET /api/live` | Current aircraft with distances |
| `GET /api/encounters` | Encounter history (paginated) |
| `GET /api/encounters/:id` | Single encounter details |
| `GET /api/encounters/:id/geojson` | Track as GeoJSON LineString |
| `GET /api/stats` | Daily/total statistics |

## Systemd Services

```bash
# AUSPEX Monitor (on Magos)
sudo systemctl status auspex-monitor
sudo systemctl restart auspex-monitor
sudo journalctl -u auspex-monitor -f

# ADS-B API (on Servitor)
ssh auspex@SERVITOR-AUSPEX-AERIS.local
sudo systemctl status adsb-api
```

## Configuration

Backend uses environment variables:
- `PORT` — API port (default: 3005)
- `DATA_DIR` — JSON storage directory
- `DUMP1090_API` — URL to servitor ADS-B API
- `CORS_ORIGIN` — CORS setting

Frontend uses:
- `VITE_API_BASE` — Backend API URL

## Encounter Detection Logic

1. **Start**: Aircraft enters 5km radius
2. **Track**: Position logged every 5 seconds
3. **End**: 60 seconds after leaving zone
4. **Auto-cleanup**: Stale encounters closed after 5 minutes

## GitHub Pages Deployment

1. Push to `main` branch
2. GitHub Actions auto-deploys to Pages
3. Configure `VITE_API_BASE` secret if needed

## License

Omnissiah-1.0 — For the glory of the Machine God.