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

export const MapView: React.FC<MapViewProps> = ({
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

    // Default Esri World Imagery (Satellite)
    const tileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; GeoSR-Insight',
      }
    ).addTo(map);

    tileLayerRef.current = tileLayer;

    // Handles Layer Group
    const handlesGroup = L.layerGroup().addTo(map);
    handlesLayerRef.current = handlesGroup;

    // Overlay Group
    const overlayGroup = L.layerGroup().addTo(map);
    overlayGroupRef.current = overlayGroup;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    let options: L.TileLayerOptions = { maxZoom: 19 };

    if (activeBaseLayer === 'Grayscale') {
      url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      options = { subdomains: 'abcd', maxZoom: 19 };
    } else if (activeBaseLayer === 'Hybrid') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }

    const newTileLayer = L.tileLayer(url, options).addTo(map);
    tileLayerRef.current = newTileLayer;
  }, [activeBaseLayer]);

  // Update AOI Polygon and Corner Handles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const coords: [number, number][] = selectedScene?.polygon || [
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
      dashArray: undefined,
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

    // Smoothly pan to the scene
    map.panTo(poly.getBounds().getCenter(), { animate: true });
  }, [selectedScene]);

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
      {/* Real Interactive Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

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
