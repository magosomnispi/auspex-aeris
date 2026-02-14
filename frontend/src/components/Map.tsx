import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import circle from '@turf/circle'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { LiveAircraft } from '../types'
import './Map.css'

interface MapProps {
  center: { lat: number; lon: number }
  aircraft: LiveAircraft[]
  selectedEncounter: number | null
  apiBase: string
  authHeader: string
}

interface DistanceRecord {
  hex: string
  flight: string | null
  distance_km: number
  lat: number
  lon: number
  altitude: number | null
  timestamp: number
  gs: number | null
  track: number | null
}

// Dark steel Mechanicus style
const MAP_STYLE = {
  version: 8,
  sources: {
    'osm': {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap, &copy; CARTO'
    }
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      paint: {
        'raster-opacity': 0.6,
        'raster-saturation': -0.5
      }
    }
  ]
}

const DETECTION_RADIUS_KM = 10

// Create aircraft SVG icon with rotation
function createAircraftIcon(track: number, color: string, isInZone: boolean): string {
  const rotation = track || 0
  return `
    <svg width="24" height="24" viewBox="0 0 24 24" style="transform: rotate(${rotation}deg); filter: drop-shadow(0 0 4px ${color});">
      <!-- Aircraft shape -->
      <path 
        d="M12 2 L14 8 L20 10 L20 12 L14 11 L13 18 L16 20 L16 21 L12 20 L8 21 L8 20 L11 18 L10 11 L4 12 L4 10 L10 8 Z" 
        fill="${color}" 
        stroke="#fff" 
        stroke-width="1"
      />
      ${isInZone ? '<circle cx="12" cy="12" r="14" fill="none" stroke="#ff4444" stroke-width="2" stroke-dasharray="3,2" opacity="0.8"/>' : ''}
    </svg>
  `
}

// Create record marker element
function createRecordMarkerElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'record-marker'
  el.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#ffd700" stroke="#ff9f1c" stroke-width="2"/>
      <text x="16" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="#000">R</text>
    </svg>
  `
  return el
}

export function Map({ center, aircraft, selectedEncounter, apiBase, authHeader }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const aircraftMarkers = useRef<globalThis.Map<string, maplibregl.Marker>>(new globalThis.Map())
  const recordMarker = useRef<maplibregl.Marker | null>(null)
  const activePopupAircraft = useRef<string | null>(null)
  const selectedTrackHex = useRef<string | null>(null)
  const encounterLine = useRef<maplibregl.GeoJSONSource | null>(null)
  const sessionTrackLine = useRef<maplibregl.GeoJSONSource | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [record, setRecord] = useState<DistanceRecord | null>(null)

  // Fetch record data on mount
  useEffect(() => {
    fetch(`${apiBase}/api/record`, { headers: { 'Authorization': authHeader } })
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.record) {
          setRecord(data.record)
          console.log(`[MAP] Record loaded: ${data.record.flight || data.record.hex} at ${data.record.distance_km.toFixed(2)}km`)
        }
      })
      .catch(err => console.log('[MAP] No record yet:', err))
  }, [apiBase, authHeader])

  // Fetch and display session track for an aircraft
  const loadSessionTrack = useCallback((hex: string) => {
    if (!map.current || !sessionTrackLine.current) return
    
    selectedTrackHex.current = hex
    
    fetch(`${apiBase}/api/session-tracks/${hex}/geojson`, {
      headers: { 'Authorization': authHeader }
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.features?.length > 0) {
          sessionTrackLine.current?.setData({
            type: 'FeatureCollection',
            features: data.features
          })
        }
      })
      .catch(err => console.error('Failed to load session track:', err))
  }, [apiBase, authHeader])

  // Clear session track display
  const clearSessionTrack = useCallback(() => {
    selectedTrackHex.current = null
    sessionTrackLine.current?.setData({ type: 'FeatureCollection', features: [] })
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE as any,
      center: [center.lon, center.lat],
      zoom: 10,
      pitch: 0,
      bearing: 0
    })

    // Add navigation control
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

    // Add center marker (station)
    new maplibregl.Marker({
      color: '#ff9f1c',
      scale: 0.8
    })
      .setLngLat([center.lon, center.lat])
      .setPopup(new maplibregl.Popup().setHTML('<b>AUSPEX ARRAY</b><br>Station Coordinates'))
      .addTo(map.current)

    // Add 10km radius circle using Turf.js
    map.current.on('load', () => {
      if (!map.current) return

      // Create circle using Turf.js - creates proper geodesic circle
      const centerPoint = [center.lon, center.lat] as [number, number]
      const circleGeojson = circle(centerPoint, DETECTION_RADIUS_KM, {
        steps: 128,
        units: 'kilometers'
      })

      // Add detection radius circle
      map.current.addSource('detection-radius', {
        type: 'geojson',
        data: circleGeojson
      })

      map.current.addLayer({
        id: 'detection-circle',
        type: 'line',
        source: 'detection-radius',
        paint: {
          'line-color': '#ff9f1c',
          'line-width': 2,
          'line-dasharray': [5, 5],
          'line-opacity': 0.6
        }
      })

      // Add fill
      map.current.addLayer({
        id: 'detection-fill',
        type: 'fill',
        source: 'detection-radius',
        paint: {
          'fill-color': '#ff9f1c',
          'fill-opacity': 0.05
        }
      })

      // Add encounter track source (for saved encounters - in zone)
      map.current.addSource('encounter-track', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })

      map.current.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'encounter-track',
        paint: {
          'line-color': '#00d4ff',
          'line-width': 4,
          'line-opacity': 0.9,
          'line-dasharray': [1, 0]
        }
      })

      // Add session track source (for all aircraft - ephemeral)
      map.current.addSource('session-track', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })

      map.current.addLayer({
        id: 'session-track-line',
        type: 'line',
        source: 'session-track',
        paint: {
          'line-color': '#ff9f1c',
          'line-width': 2,
          'line-opacity': 0.6,
          'line-dasharray': [4, 4]
        }
      }, 'track-line') // Place below encounter track

      encounterLine.current = map.current.getSource('encounter-track') as maplibregl.GeoJSONSource
      sessionTrackLine.current = map.current.getSource('session-track') as maplibregl.GeoJSONSource
      setIsLoaded(true)
    })

    // Click on map to close popup and clear track
    map.current.on('click', (e) => {
      // If clicked on map (not on marker), clear active popup tracking
      const features = map.current?.queryRenderedFeatures(e.point)
      if (!features || features.length === 0) {
        activePopupAircraft.current = null
        clearSessionTrack()
      }
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [center, clearSessionTrack])

  // Update record marker - works exactly like aircraft markers
  useEffect(() => {
    if (!map.current || !isLoaded || !record) return

    // Remove existing record marker
    if (recordMarker.current) {
      recordMarker.current.remove()
      recordMarker.current = null
    }

    // Create new record marker (same pattern as aircraft markers)
    const el = createRecordMarkerElement()
    
    const popupContent = `
      <div style="font-family: 'Cascadia Code', monospace; padding: 10px; max-width: 280px; background: #1a1a1f; border: 2px solid #ffd700; border-radius: 4px;">
        <div style="font-weight: bold; color: #ffd700; font-size: 14px; margin-bottom: 6px; text-align: center;">
          🏆 DISTANCE RECORD HOLDER
        </div>
        <div style="color: #fff; font-size: 16px; margin-bottom: 4px; text-align: center;">
          ${record.flight || record.hex}
        </div>
        <div style="color: #ff9f1c; font-size: 20px; font-weight: bold; text-align: center; margin: 8px 0;">
          ${record.distance_km.toFixed(2)} km
        </div>
        <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px; font-size: 11px; color: #888;">
          <div>Altitude: ${record.altitude ? record.altitude.toLocaleString() + ' ft' : 'N/A'}</div>
          <div>Speed: ${record.gs ? record.gs + ' kt' : 'N/A'}</div>
          <div>Heading: ${record.track ? Math.round(record.track) + '°' : 'N/A'}</div>
          <div style="margin-top: 6px; color: #666;">
            Recorded: ${new Date(record.timestamp * 1000).toLocaleString('sv-SE')}
          </div>
        </div>
      </div>
    `

    const popup = new maplibregl.Popup({ 
      closeButton: false,
      closeOnClick: false,
      offset: 15
    }).setHTML(popupContent)

    recordMarker.current = new maplibregl.Marker({ 
      element: el,
      anchor: 'center'
    })
      .setLngLat([record.lon, record.lat])
      .setPopup(popup)
      .addTo(map.current)

    console.log(`[MAP] Record marker added: ${record.flight || record.hex} at ${record.distance_km.toFixed(2)}km`)
  }, [record, isLoaded])

  // Update aircraft markers - preserve popup state
  useEffect(() => {
    if (!map.current || !isLoaded) return

    const currentHexes = new Set(aircraft.map(ac => ac.hex))
    const existingMarkers = aircraftMarkers.current

    // Remove markers for aircraft that are no longer present
    existingMarkers.forEach((marker, hex) => {
      if (!currentHexes.has(hex)) {
        marker.remove()
        existingMarkers.delete(hex)
      }
    })

    // Update or create markers
    aircraft.forEach(ac => {
      if (!map.current) return

      const isInZone = ac.distance_km <= DETECTION_RADIUS_KM
      const color = isInZone ? '#ff4444' : '#00d4ff'
      const existingMarker = existingMarkers.get(ac.hex)

      const altMeters = ac.altitude ? Math.round(ac.altitude * 0.3048) : null
      const altDisplay = ac.altitude 
        ? `${ac.altitude.toLocaleString()} ft (${altMeters?.toLocaleString()} m)` 
        : 'N/A'

      const trackType = isInZone ? 'PERSISTENT (In Zone)' : 'SESSION (Ephemeral)'

      const popupContent = `
        <div style="font-family: 'Cascadia Code', monospace; padding: 8px; max-width: 280px;">
          <div style="font-weight: bold; color: ${color}; font-size: 14px; margin-bottom: 4px;">
            ✈ ${ac.flight || 'UNKNOWN'}
          </div>
          <div style="color: #888; font-size: 11px; margin-bottom: 6px;">
            HEX: ${ac.hex}
          </div>
          <div style="font-size: 10px; color: ${isInZone ? '#ff4444' : '#ff9f1c'}; margin-bottom: 8px; border: 1px solid ${isInZone ? '#ff4444' : '#ff9f1c'}; padding: 2px 6px; border-radius: 3px; display: inline-block;">
            ${trackType}
          </div>
          <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12px;">
            <span style="color: #666;">Altitude:</span>
            <span style="color: #ccc;">${altDisplay}</span>
            <span style="color: #666;">Speed:</span>
            <span style="color: #ccc;">${ac.gs ? ac.gs + ' kt' : 'N/A'}</span>
            <span style="color: #666;">Track:</span>
            <span style="color: #ccc;">${ac.track ? Math.round(ac.track) + '°' : 'N/A'}</span>
            <span style="color: #666;">Distance:</span>
            <span style="color: ${color};">${ac.distance_km.toFixed(1)} km ${isInZone ? '⚠ IN ZONE' : ''}</span>
          </div>
          ${!isInZone ? '<div style="margin-top: 8px; font-size: 10px; color: #666; font-style: italic;">Click to view session trail</div>' : ''}
        </div>
      `

      if (existingMarker) {
        // Update existing marker position and icon
        existingMarker.setLngLat([ac.lon, ac.lat])
        
        // Update the marker element with new icon
        const el = existingMarker.getElement()
        el.innerHTML = createAircraftIcon(ac.track || 0, color, isInZone)
        
        // Update popup content
        const popup = existingMarker.getPopup()
        if (popup) {
          popup.setHTML(popupContent)
        }

        // Restore popup if this aircraft had it open
        if (activePopupAircraft.current === ac.hex) {
          existingMarker.togglePopup()
        }
      } else {
        // Create new marker with aircraft icon
        const el = document.createElement('div')
        el.className = 'aircraft-marker'
        el.style.cursor = 'pointer'
        el.innerHTML = createAircraftIcon(ac.track || 0, color, isInZone)

        const popup = new maplibregl.Popup({ 
          closeButton: false,
          closeOnClick: false,
          offset: 15
        }).setHTML(popupContent)

        const marker = new maplibregl.Marker({ 
          element: el,
          anchor: 'center'
        })
          .setLngLat([ac.lon, ac.lat])
          .setPopup(popup)
          .addTo(map.current)

        // Track popup state and load session track on click
        el.addEventListener('click', () => {
          activePopupAircraft.current = ac.hex
          // Always load session track when clicking an aircraft
          loadSessionTrack(ac.hex)
        })

        existingMarkers.set(ac.hex, marker)

        // Restore popup if this aircraft should have it open
        if (activePopupAircraft.current === ac.hex) {
          marker.togglePopup()
          loadSessionTrack(ac.hex)
        }
      }
    })
  }, [aircraft, isLoaded, loadSessionTrack])

  // Update encounter track (for selected encounter from sidebar)
  useEffect(() => {
    if (!encounterLine.current) return
    
    if (!selectedEncounter) {
      encounterLine.current.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    fetch(`${apiBase}/api/encounters/${selectedEncounter}/geojson`, {
      headers: { 'Authorization': authHeader }
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.features?.length > 0) {
          encounterLine.current?.setData({
            type: 'FeatureCollection',
            features: data.features
          })
        }
      })
      .catch(err => console.error('Failed to load encounter track:', err))
  }, [selectedEncounter, apiBase, authHeader])

  return <div ref={mapContainer} className="map-view" />
}