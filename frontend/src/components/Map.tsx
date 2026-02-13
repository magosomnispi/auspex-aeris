import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { LiveAircraft } from '../types'
import './Map.css'

interface MapProps {
  center: { lat: number; lon: number }
  aircraft: LiveAircraft[]
  selectedEncounter: number | null
  apiBase: string
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

export function Map({ center, aircraft, selectedEncounter, apiBase }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const aircraftMarkers = useRef<maplibregl.Marker[]>([])
  const encounterLine = useRef<maplibregl.GeoJSONSource | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

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

    // Add 10km radius circle
    map.current.on('load', () => {
      if (!map.current) return

      // Add detection radius circle using proper geodesic circle
      map.current.addSource('detection-radius', {
        type: 'geojson',
        data: createGeodesicCircle(center.lon, center.lat, DETECTION_RADIUS_KM)
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

      // Add encounter track source
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
          'line-width': 3,
          'line-opacity': 0.8
        }
      })

      encounterLine.current = map.current.getSource('encounter-track') as maplibregl.GeoJSONSource
      setIsLoaded(true)
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [center])

  // Update aircraft markers
  useEffect(() => {
    if (!map.current || !isLoaded) return

    // Clear existing markers
    aircraftMarkers.current.forEach(marker => marker.remove())
    aircraftMarkers.current = []

    // Add new markers
    aircraft.forEach(ac => {
      if (!map.current) return

      const isInZone = ac.distance_km <= DETECTION_RADIUS_KM
      const color = isInZone ? '#ff4444' : '#00d4ff'
      const el = document.createElement('div')
      el.className = 'aircraft-marker'
      el.innerHTML = `<div style="
        width: 12px;
        height: 12px;
        background: ${color};
        border-radius: 50%;
        border: 2px solid #fff;
        box-shadow: 0 0 10px ${color};
        ${isInZone ? 'animation: pulse 1s ease-in-out infinite;' : ''}
      "></div>`

      const altMeters = ac.altitude ? Math.round(ac.altitude * 0.3048) : null
      const altDisplay = ac.altitude 
        ? `${ac.altitude.toLocaleString()} ft (${altMeters?.toLocaleString()} m)` 
        : 'N/A'

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([ac.lon, ac.lat])
        .setPopup(new maplibregl.Popup().setHTML(`
          <b>${ac.flight || 'UNKNOWN'}</b><br>
          Hex: ${ac.hex}<br>
          Alt: ${altDisplay}<br>
          Speed: ${ac.gs ? ac.gs + ' kt' : 'N/A'}<br>
          Dist: ${ac.distance_km.toFixed(1)} km
        `))
        .addTo(map.current)

      aircraftMarkers.current.push(marker)
    })
  }, [aircraft, isLoaded])

  // Update encounter track
  useEffect(() => {
    if (!encounterLine.current || !selectedEncounter) {
      encounterLine.current?.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    fetch(`${apiBase}/api/encounters/${selectedEncounter}/geojson`)
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
  }, [selectedEncounter, apiBase])

  return <div ref={mapContainer} className="map-view" />
}

// Create proper geodesic circle GeoJSON
// Uses destination calculation to maintain true circle shape
function createGeodesicCircle(lon: number, lat: number, radiusKm: number): GeoJSON.Feature {
  const points = 128 // More points for smoother circle
  const coords: [number, number][] = []
  
  // Earth's radius in km
  const R = 6371
  
  // Convert center to radians
  const latRad = lat * Math.PI / 180
  const lonRad = lon * Math.PI / 180
  
  // Angular distance (radius in radians)
  const angularDist = radiusKm / R
  
  for (let i = 0; i < points; i++) {
    const bearing = (i / points) * 2 * Math.PI
    
    // Calculate destination point using spherical trigonometry
    const destLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDist) +
      Math.cos(latRad) * Math.sin(angularDist) * Math.cos(bearing)
    )
    
    const destLon = lonRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDist) * Math.cos(latRad),
      Math.cos(angularDist) - Math.sin(latRad) * Math.sin(destLat)
    )
    
    // Convert back to degrees
    coords.push([
      destLon * 180 / Math.PI,
      destLat * 180 / Math.PI
    ])
  }
  
  // Close the ring
  coords.push(coords[0])
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords]
    },
    properties: {
      radius_km: radiusKm
    }
  }
}