import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MousePointer,
  Hand,
  MapPin,
  Pentagon,
  Circle,
  Spline,
  Trash2,
  Crosshair,
  Plus,
  Minus,
  Layers,
} from 'lucide-react';
import type { SatelliteScene } from '../data/mockData';

interface MapViewProps {
  coordinates?: string;
  onCoordinatesChange?: (coords: string) => void;
  isMarkMode?: boolean;
  selectedScene?: SatelliteScene;
  activeBaseLayer?: 'Satellite Imagery' | 'Grayscale' | 'Hybrid';
  layerToggles?: {
    adminBoundaries: boolean;
    placeLabels: boolean;
    riversWaterbodies: boolean;
    roads: boolean;
    grid: boolean;
  };
}

// Parse string representation into Leaflet Lat/Lon pairs [[lat, lon], ...]
function parseToLeafletCoords(coordsStr?: string): [number, number][] {
  if (!coordsStr) {
    return [
      [32.70, 75.85],
      [32.70, 75.93],
      [32.78, 75.93],
      [32.78, 75.85],
    ];
  }
  try {
    const trimmed = coordsStr.trim();
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        // [ [lon, lat], ... ]
        return parsed.map((pt: number[]) => [pt[1], pt[0]] as [number, number]);
      } else if (Array.isArray(parsed) && parsed.length === 4) {
        // [minLon, minLat, maxLon, maxLat]
        const [minLon, minLat, maxLon, maxLat] = parsed;
        return [
          [minLat, minLon],
          [minLat, maxLon],
          [maxLat, maxLon],
          [maxLat, minLon],
        ];
      }
    } else {
      const parts = trimmed.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length === 4 && !parts.some(isNaN)) {
        const [minLon, minLat, maxLon, maxLat] = parts;
        return [
          [minLat, minLon],
          [minLat, maxLon],
          [maxLat, maxLon],
          [maxLat, minLon],
        ];
      }
    }
  } catch {
    // Return standard coordinates if malformed while typing
  }
  return [
    [32.70, 75.85],
    [32.70, 75.93],
    [32.78, 75.93],
    [32.78, 75.85],
  ];
}

export const MapView: React.FC<MapViewProps> = ({
  coordinates,
  onCoordinatesChange,
  isMarkMode = false,
  selectedScene,
  activeBaseLayer = 'Satellite Imagery',
  layerToggles = {
    adminBoundaries: true,
    placeLabels: true,
    riversWaterbodies: true,
    roads: false,
    grid: false,
  },
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const handlesLayerRef = useRef<L.LayerGroup | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeGisTool, setActiveGisTool] = useState<
    'select' | 'pan' | 'marker' | 'polygon' | 'circle' | 'line' | 'delete'
  >('select');

  // Center of Kashmir / Pir Panjal mountain range matching coordinates in screenshot
  const defaultCenter: [number, number] = [32.74, 75.89];
  const defaultZoom = 11;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create Map
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
      attributionControl: false,
      minZoom: 4,
      maxZoom: 18,
    });

    mapInstanceRef.current = map;

    // 1. High-Reliability Underlying Base Layer (Guarantees map NEVER renders black)
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: '&copy; CartoDB &copy; OpenStreetMap',
      }
    ).addTo(map);

    // 2. High-Resolution Esri World Imagery (Satellite) with safe maxNativeZoom
    const tileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        maxNativeZoom: 18,
        attribution: 'Tiles &copy; Esri &mdash; GeoLens Engine',
      }
    ).addTo(map);

    tileLayerRef.current = tileLayer;

    // Handles Layer Group
    const handlesGroup = L.layerGroup().addTo(map);
    handlesLayerRef.current = handlesGroup;

    // Overlay Group
    const overlayGroup = L.layerGroup().addTo(map);
    overlayGroupRef.current = overlayGroup;

    // Trigger initial invalidateSize to ensure tiles load immediately
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Ensure map size is recalculated when coordinates or marking mode changes
  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [coordinates, isMarkMode]);

  // Map Click Listener for interactive coordinate marking
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      // Allow marking if in mark mode OR if marker/polygon GIS tool is active
      if (isMarkMode || activeGisTool === 'marker' || activeGisTool === 'polygon') {
        const centerLat = e.latlng.lat;
        const centerLng = e.latlng.lng;

        // Calculate a safe 8.0 km x 8.0 km bounding box matching the 3x SR benchmark
        const halfLat = (8.0 / 111.32) / 2;
        const latCos = Math.cos((centerLat * Math.PI) / 180);
        const halfLon = (8.0 / (111.32 * (latCos || 1))) / 2;

        const minLat = +(centerLat - halfLat).toFixed(4);
        const maxLat = +(centerLat + halfLat).toFixed(4);
        const minLon = +(centerLng - halfLon).toFixed(4);
        const maxLon = +(centerLng + halfLon).toFixed(4);

        const newFormatted = `[[${minLon}, ${minLat}], [${maxLon}, ${minLat}],\n [${maxLon}, ${maxLat}], [${minLon}, ${maxLat}]]`;
        
        if (onCoordinatesChange) {
          onCoordinatesChange(newFormatted);
        }
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isMarkMode, activeGisTool, onCoordinatesChange]);

  // Update Base Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    let options: L.TileLayerOptions = { maxZoom: 19, maxNativeZoom: 18 };

    if (activeBaseLayer === 'Grayscale') {
      url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      options = { subdomains: 'abcd', maxZoom: 19 };
    } else if (activeBaseLayer === 'Hybrid') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }

    const newTileLayer = L.tileLayer(url, options).addTo(map);
    tileLayerRef.current = newTileLayer;
    map.invalidateSize();
  }, [activeBaseLayer]);

  // Update AOI Polygon and Corner Handles whenever coordinates or selectedScene changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const coords: [number, number][] = coordinates
      ? parseToLeafletCoords(coordinates)
      : selectedScene?.polygon || [
          [32.70, 75.85],
          [32.70, 75.93],
          [32.78, 75.93],
          [32.78, 75.85],
        ];

    // Remove previous polygon
    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
    }

    // Create AOI Polygon
    const poly = L.polygon(coords, {
      color: '#2563eb',
      weight: 2.5,
      opacity: 0.95,
      fillColor: '#2563eb',
      fillOpacity: 0.22,
    }).addTo(map);

    polygonLayerRef.current = poly;

    // Update corner handles
    if (handlesLayerRef.current) {
      handlesLayerRef.current.clearLayers();

      coords.forEach((point) => {
        const handleMarker = L.circleMarker(point, {
          radius: 5,
          color: '#2563eb',
          weight: 2,
          fillColor: '#ffffff',
          fillOpacity: 1,
        });
        handlesLayerRef.current?.addLayer(handleMarker);
      });
    }

    // Smoothly fit bounds so the bounding box is ALWAYS visible and centered
    try {
      const bounds = poly.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12, animate: true });
        map.invalidateSize();
      }
    } catch {
      // Ignore boundary calculation issues during rapid typing
    }
  }, [coordinates, selectedScene]);

  // Update Overlays
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = overlayGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // Place labels simulation
    if (layerToggles.placeLabels) {
      const places: { name: string; pos: [number, number] }[] = [
        { name: 'Kishtwar Valley', pos: [32.75, 75.83] },
        { name: 'Chenab Ridge', pos: [32.78, 75.92] },
        { name: 'Pir Panjal Peak 3840m', pos: [32.84, 75.88] },
        { name: 'Sinthan Pass Corridor', pos: [32.69, 75.94] },
      ];

      places.forEach((p) => {
        const icon = L.divIcon({
          className: 'bg-transparent text-white font-semibold text-[11px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] whitespace-nowrap flex items-center gap-1',
          html: `<span class="inline-block w-2 h-2 rounded-full bg-amber-400 border border-white shadow"></span> ${p.name}`,
          iconSize: [120, 20],
          iconAnchor: [10, 10],
        });
        const marker = L.marker(p.pos, { icon });
        group.addLayer(marker);
      });
    }

    // Rivers & Waterbodies simulation
    if (layerToggles.riversWaterbodies) {
      const riverCoords: [number, number][] = [
        [32.66, 75.81],
        [32.71, 75.86],
        [32.75, 75.88],
        [32.82, 75.91],
        [32.86, 75.95],
      ];
      const riverPolyline = L.polyline(riverCoords, {
        color: '#38bdf8',
        weight: 3.5,
        opacity: 0.85,
        lineCap: 'round',
      });
      group.addLayer(riverPolyline);
    }

    // Administrative boundaries
    if (layerToggles.adminBoundaries) {
      const adminCoords: [number, number][] = [
        [32.65, 75.76],
        [32.85, 75.76],
        [32.88, 76.05],
        [32.65, 76.05],
      ];
      const adminPolyline = L.polyline(adminCoords, {
        color: '#fbbf24',
        weight: 1.5,
        dashArray: '6, 6',
        opacity: 0.9,
      });
      group.addLayer(adminPolyline);
    }

    // Roads
    if (layerToggles.roads) {
      const roadCoords: [number, number][] = [
        [32.68, 75.78],
        [32.72, 75.83],
        [32.76, 75.91],
        [32.81, 75.98],
      ];
      const roadPolyline = L.polyline(roadCoords, {
        color: '#f97316',
        weight: 2,
        opacity: 0.8,
      });
      group.addLayer(roadPolyline);
    }
  }, [layerToggles]);

  // Zoom handlers
  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleResetLocation = () => {
    mapInstanceRef.current?.setView(defaultCenter, defaultZoom, { animate: true });
  };

  return (
    <div className="relative w-full h-[520px] lg:h-[560px] bg-slate-900 rounded-lg overflow-hidden border border-slate-300 shadow-sm select-none">
      {/* Real Interactive Leaflet Container Wrapper to preserve Leaflet classes */}
      <div className={`absolute inset-0 z-0 ${isMarkMode ? 'cursor-crosshair' : ''}`}>
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Mark on Map Mode Indicator Banner */}
      {isMarkMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 text-white px-4 py-1.5 rounded-full shadow-xl border border-blue-500/80 backdrop-blur-md flex items-center space-x-2 text-[12px] font-medium">
          <MapPin className="h-4 w-4 text-amber-400 animate-bounce" />
          <span>Click anywhere to place the 3&times; SR Bounding Box (~8.0 km &times; 8.0 km)</span>
        </div>
      )}

      {/* Floating Left GIS Toolbar */}
      <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200/90 shadow-lg p-1 flex flex-col space-y-1">
        <button
          onClick={() => setActiveGisTool('select')}
          title="Select tool"
          className={`p-2 rounded-md transition-colors ${
            activeGisTool === 'select'
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <MousePointer className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveGisTool('pan')}
          title="Pan tool"
          className={`p-2 rounded-md transition-colors ${
            activeGisTool === 'pan'
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Hand className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveGisTool('marker')}
          title="Place marker"
          className={`p-2 rounded-md transition-colors ${
            activeGisTool === 'marker'
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <MapPin className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveGisTool('polygon')}
          title="Draw AOI Polygon"
          className={`p-2 rounded-md transition-colors ${
            activeGisTool === 'polygon'
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Pentagon className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveGisTool('circle')}
          title="Draw circle AOI"
          className={`p-2 rounded-md transition-colors ${
            activeGisTool === 'circle'
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Circle className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveGisTool('line')}
          title="Measure distance / line"
          className={`p-2 rounded-md transition-colors ${
            activeGisTool === 'line'
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Spline className="h-4 w-4" />
        </button>

        <div className="w-full h-px bg-slate-200 my-0.5" />

        <button
          onClick={() => setActiveGisTool('delete')}
          title="Clear / Delete selection"
          className={`p-2 rounded-md transition-colors ${
            activeGisTool === 'delete'
              ? 'bg-red-500 text-white shadow-sm'
              : 'text-slate-600 hover:bg-red-50 hover:text-red-600'
          }`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Floating Right Map Controls */}
      <div className="absolute bottom-6 right-4 z-10 flex flex-col space-y-2">
        {/* Recenter / Target */}
        <button
          onClick={handleResetLocation}
          title="Recenter Area of Interest"
          className="p-2 bg-white/95 backdrop-blur-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md shadow-md border border-slate-200/90 transition-colors"
        >
          <Crosshair className="h-4 w-4" />
        </button>

        {/* Zoom Controls */}
        <div className="bg-white/95 backdrop-blur-sm rounded-md shadow-md border border-slate-200/90 overflow-hidden flex flex-col">
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors border-b border-slate-100"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>

        {/* Layer toggle action icon */}
        <button
          title="Map Layers"
          className="p-2 bg-white/95 backdrop-blur-sm text-[#2563eb] hover:bg-slate-100 rounded-md shadow-md border border-slate-200/90 transition-colors"
        >
          <Layers className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom Left Scale Bar */}
      <div className="absolute bottom-4 left-4 z-10 bg-slate-950/75 backdrop-blur-[2px] text-white px-3 py-1.5 rounded text-[11px] font-mono border border-white/20 shadow-md">
        <div className="flex justify-between text-[10px] text-slate-300 font-sans mb-0.5">
          <span>0</span>
          <span>5</span>
          <span>10 km</span>
        </div>
        <div className="w-28 h-1.5 flex border border-white/80">
          <div className="bg-white flex-1" />
          <div className="bg-black flex-1" />
          <div className="bg-white flex-1" />
          <div className="bg-black flex-1" />
        </div>
      </div>
    </div>
  );
};
