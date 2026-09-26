import "maplibre-gl/dist/maplibre-gl.css";

import { Map as MapLibreMap } from "maplibre-gl";
import { Crosshair, LocateFixed, Minus, Plus, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type GeoMapProps = {
  processed: boolean;
  processing: boolean;
  region: string;
  layers: { uncertainty: boolean; ndvi: boolean; ndwi: boolean; extraction: boolean };
  drawMode: "box" | "polygon" | null;
  onDrawComplete: () => void;
};

const regions: Record<string, { center: [number, number]; zoom: number }> = {
  "Aligarh Agrarian Sector": { center: [78.088, 27.897], zoom: 12.3 },
  "Mumbai Urban Corridor": { center: [72.878, 19.076], zoom: 12.5 },
  "Nashik Border Zone": { center: [73.7898, 20.011], zoom: 12.5 },
  "Custom AOI": { center: [75.7, 20.6], zoom: 7 },
};

const rasterTiles = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];

const defaultRegion = { center: [73.7898, 20.011] as [number, number], zoom: 12.5 };

export function GeoMap({ processed, processing, region, layers, drawMode, onDrawComplete }: GeoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [split, setSplit] = useState(processed ? 52 : 88);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const config = regions[region] ?? defaultRegion;
    const map = new MapLibreMap({
      container: containerRef.current,
      center: config.center,
      zoom: config.zoom,
      attributionControl: false,
      style: {
        version: 8,
        sources: { satellite: { type: "raster", tiles: rasterTiles, tileSize: 256 } },
        layers: [
          { id: "satellite", type: "raster", source: "satellite", paint: { "raster-saturation": -0.35, "raster-contrast": 0.32, "raster-brightness-max": 0.72 } },
        ],
      },
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const config = regions[region] ?? defaultRegion;
    map?.flyTo({ center: config.center, zoom: config.zoom, duration: 1100 });
  }, [region]);

  useEffect(() => {
    if (processed) setSplit(52);
  }, [processed]);

  const startDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawMode) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawing(true);
  };

  const endDraw = () => {
    if (!drawing) return;
    setDrawing(false);
    onDrawComplete();
  };

  return (
    <div className="relative size-full overflow-hidden bg-background" onPointerDown={startDraw} onPointerUp={endDraw}>
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-background/10 mix-blend-multiply" />
      <div className="tactical-grid pointer-events-none absolute inset-0" />

      <div className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden border-r border-info/80" style={{ width: `${split}%` }}>
        <div className="absolute inset-0 bg-background/12 backdrop-blur-[1.7px]" />
        <div className="absolute left-4 top-4 whitespace-nowrap rounded border border-warning/40 bg-background/85 px-2.5 py-1.5 font-mono text-[10px] text-warning">
          RAW SENTINEL-2 · 10m GSD
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 overflow-hidden" style={{ width: `${100 - split}%` }}>
        <div className="absolute right-4 top-4 whitespace-nowrap rounded border border-primary/40 bg-background/85 px-2.5 py-1.5 font-mono text-[10px] text-primary">
          SUPER-RESOLVED · 2.5m GSD
        </div>
        {layers.uncertainty && <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,var(--success),transparent_18%),radial-gradient(circle_at_40%_70%,var(--warning),transparent_24%)] opacity-25 mix-blend-screen" />}
        {layers.ndvi && <div className="absolute inset-0 bg-primary/20 mix-blend-color" />}
        {layers.ndwi && <div className="absolute inset-0 bg-info/20 mix-blend-color" />}
      </div>

      <input aria-label="Satellite comparison curtain" type="range" min="12" max="88" value={split} onChange={(event) => setSplit(Number(event.target.value))} className="absolute inset-x-6 bottom-7 z-30 h-1 cursor-ew-resize accent-info" />
      <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-info shadow-[0_0_14px_var(--color-info)]" style={{ left: `${split}%` }}>
        <div className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-info bg-background text-info shadow-lg">↔</div>
      </div>

      {(drawMode || layers.extraction) && (
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="410,208 655,190 700,416 445,445" fill="var(--color-info)" fillOpacity=".08" stroke="var(--color-info)" strokeWidth="2" strokeDasharray="8 6" />
          {layers.extraction && <g fill="none" stroke="var(--color-warning)" strokeWidth="2"><rect x="505" y="255" width="58" height="38" transform="rotate(-8 534 274)"/><rect x="590" y="322" width="78" height="44" transform="rotate(5 629 344)"/><path d="M420 390 C520 350 610 430 735 350" stroke="var(--color-primary)" strokeWidth="5"/></g>}
        </svg>
      )}

      {processing && <div className="scanline pointer-events-none absolute inset-x-0 top-0 h-px bg-primary shadow-[0_0_18px_var(--color-primary)]" />}
      <div className="absolute bottom-14 right-4 z-30 grid gap-1">
        <Button size="icon" variant="outline" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}><Plus className="size-4" /></Button>
        <Button size="icon" variant="outline" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}><Minus className="size-4" /></Button>
        <Button size="icon" variant="outline" aria-label="Recenter map" onClick={() => mapRef.current?.flyTo(regions[region] ?? defaultRegion)}><LocateFixed className="size-4" /></Button>
      </div>
      <div className="absolute bottom-14 left-4 flex items-center gap-2 rounded border border-border bg-background/85 px-2 py-1 font-mono text-[9px] text-muted-foreground">
        <Crosshair className="size-3 text-primary" /> 20°00'39.6&quot;N · 73°47'23.3&quot;E <span className="text-info">Z12.5</span>
      </div>
      <div className="absolute right-4 top-4 z-30 flex items-center gap-1.5 rounded border border-primary/30 bg-background/80 px-2 py-1 font-mono text-[9px] text-primary"><ScanLine className="size-3" /> LIVE VIEWPORT</div>
    </div>
  );
}