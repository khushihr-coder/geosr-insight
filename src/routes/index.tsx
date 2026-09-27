import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import * as Tabs from "@radix-ui/react-tabs";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity, AlertTriangle, BoxSelect, ChevronDown, ChevronLeft, ChevronRight, CircleDot, CloudCog,
  Download, FileArchive, FileDown, Layers3, LoaderCircle, Menu, Orbit, Pentagon,
  Radio, Scan, ServerCog, Upload, X, Zap,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CloudCleanserResults, type CloudCleanserData } from "@/components/cloud-cleanser-results";
import { useCloudCleanser } from "@/hooks/use-cloud-cleanser";
import { cn } from "@/lib/utils";

const GeoMap = lazy(() => import("@/components/geo-map").then((module) => ({ default: module.GeoMap })));

export const Route = createFileRoute("/")(
  {
  head: () => ({ meta: [
    { title: "GeoSR AI | Sub-4m Super-Resolution Portal" },
    { name: "description", content: "Defense-grade satellite super-resolution mapping and spectral intelligence analytics for SIH 2026 NTRO." },
    { property: "og:title", content: "GeoSR AI | Satellite Super-Resolution Mapping" },
    { property: "og:description", content: "Interactive 4x geospatial enhancement and downstream intelligence analytics." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

const regions = ["Aligarh Agrarian Sector", "Mumbai Urban Corridor", "Nashik Border Zone", "Custom AOI"];

const aoiPresets: Record<string, [number, number, number, number]> = {
  "Aligarh Agrarian Sector": [78.05, 27.87, 78.12, 27.93],
  "Mumbai Urban Corridor": [72.83, 19.04, 72.93, 19.11],
  "Nashik Border Zone": [73.78, 19.95, 73.81, 19.98],
};

const steps = ["Fetching GEE Tiles", "Inpainting Clouds", "Executing Multi-Spectral HAT", "Writing GeoTIFF"];
const cloudSteps = ["Fetching S2 + S1 from GEE", "Detecting Cloud Coverage", "Running SAR Cross-Attention", "Generating Cloud-Free GeoTIFF"];

function Status({ label, value, tone = "primary" }: { label: string; value: string; tone?: "primary" | "info" }) {
  return <div className="hidden min-w-0 items-center gap-2 border-l border-border pl-3 xl:flex"><span className={cn("size-1.5 shrink-0 rounded-full", tone === "primary" ? "bg-primary shadow-[0_0_8px_var(--color-primary)]" : "bg-info")} /><div className="min-w-0"><p className="truncate text-[9px] uppercase text-muted-foreground">{label}</p><p className="truncate font-mono text-[10px] text-foreground">{value}</p></div></div>;
}

function MiniChart({ color = "primary" }: { color?: "primary" | "info" | "warning" }) {
  return <svg viewBox="0 0 84 26" className={cn("h-7 w-20", color === "primary" ? "text-primary" : color === "info" ? "text-info" : "text-warning")}><path d="M2 21 L14 18 L25 20 L35 10 L45 14 L56 7 L68 9 L82 3" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M2 21 L14 18 L25 20 L35 10 L45 14 L56 7 L68 9 L82 3 V26 H2Z" fill="currentColor" opacity=".1" /></svg>;
}

function ToggleRow({ label, checked, onCheckedChange, metric }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void; metric?: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 last:border-0"><div className="min-w-0"><p className="text-[11px] text-foreground">{label}</p>{metric && <p className="font-mono text-[9px] text-primary">{metric}</p>}</div><Switch.Root checked={checked} onCheckedChange={onCheckedChange} className="relative h-5 w-9 shrink-0 rounded-full border border-border bg-muted data-[state=checked]:border-primary/50 data-[state=checked]:bg-primary/25"><Switch.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-muted-foreground transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-primary" /></Switch.Root></div>;
}

function PanelHeader({ icon: Icon, title, side, close }: { icon: typeof Activity; title: string; side: "left" | "right"; close: () => void }) {
  return <div className="flex h-12 items-center justify-between border-b border-border px-3"><div className="flex min-w-0 items-center gap-2"><Icon className="size-4 shrink-0 text-primary"/><h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.12em]">{title}</h2></div><Button variant="ghost" size="icon" aria-label={`Close ${side} panel`} onClick={close}>{side === "left" ? <ChevronLeft className="size-4"/> : <ChevronRight className="size-4"/>}</Button></div>;
}

function Index() {
  const [region, setRegion] = useState("Nashik Border Zone");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [aoiReady, setAoiReady] = useState(true);
  const [drawMode, setDrawMode] = useState<"box" | "polygon" | null>(null);
  const [bands, setBands] = useState({ B02: true, B03: true, B04: true, B08: true });
  const [layers, setLayers] = useState({ uncertainty: false, ndvi: false, ndwi: false, extraction: false });

  // ── Cloud Cleanser Integration ─────────────────────────────────
  const [cloudCleanserEnabled, setCloudCleanserEnabled] = useState(true);
  const [showCleanserResults, setShowCleanserResults] = useState(false);
  const [bboxCoords, setBboxCoords] = useState<[number, number, number, number]>([73.78, 19.95, 73.81, 19.98]);
  const [startDate, setStartDate] = useState("2026-09-01");
  const [endDate, setEndDate] = useState("2026-09-24");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanser = useCloudCleanser();

  // Sync AOI presets with bbox coordinates
  useEffect(() => {
    const preset = aoiPresets[region];
    if (preset) {
      setBboxCoords(preset);
    }
  }, [region]);

  // ── Processing workflow (preserves 2.5s mock per AGENTS.md) ────
  useEffect(() => {
    if (!processing) return;

    if (cloudCleanserEnabled) {
      // Cloud cleanser pipeline
      cleanser.processPolygon({
        bbox: bboxCoords,
        startDate,
        endDate,
      });
    }

    const timer = window.setInterval(() => setProgress((value) => Math.min(value + 4, 100)), 100);
    const done = window.setTimeout(() => {
      setProcessing(false);
      setProcessed(true);
      setLayers((value) => ({ ...value, uncertainty: true }));
      setProgress(100);
      if (cloudCleanserEnabled) {
        setShowCleanserResults(true);
      }
    }, 2500);
    return () => { window.clearInterval(timer); window.clearTimeout(done); };
  }, [processing]);

  const run = () => { setProcessed(false); setProgress(0); setProcessing(true); setShowCleanserResults(false); };
  const currentStep = Math.min(Math.floor(progress / 25), 3);
  const activeSteps = cloudCleanserEnabled ? cloudSteps : steps;

  // ── File upload handler ────────────────────────────────────────
  const handleFileUpload = useCallback(
    (file: File) => {
      setUploadOpen(false);
      setProcessing(true);
      setProcessed(false);
      setProgress(0);

      cleanser.uploadGeoTIFF({ file });

      const timer = window.setInterval(() => setProgress((v) => Math.min(v + 4, 100)), 100);
      const done = window.setTimeout(() => {
        clearInterval(timer);
        setProcessing(false);
        setProcessed(true);
        setProgress(100);
        setShowCleanserResults(true);
      }, 2500);

      return () => { clearInterval(timer); clearTimeout(done); };
    },
    [cleanser],
  );

  // Use cleanser result if available, otherwise generate mock
  const cleanserData: CloudCleanserData | null = cleanser.result ?? (
    showCleanserResults
      ? {
          cloudCoverage: 87.4,
          dateS2: "2026-09-24",
          dateS1: "2026-09-22",
          inferenceTime: 2.48,
          cloudyUrl: "",
          sarUrl: "",
          cleanUrl: "",
          downloadUrl: null,
        }
      : null
  );

  return <main className="flex h-dvh min-w-0 flex-col overflow-hidden bg-background text-foreground">
    <header className="z-50 grid h-[68px] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-surface px-3 lg:grid-cols-[minmax(310px,1fr)_minmax(360px,1.2fr)_auto]">
      <div className="flex min-w-0 items-center gap-3"><div className="relative grid size-9 shrink-0 place-items-center border border-primary/40 bg-primary/10"><Orbit className="size-5 text-primary"/><span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary"/></div><div className="min-w-0"><h1 className="truncate text-sm font-semibold">GeoSR AI <span className="text-muted-foreground">|</span> <span className="text-info">Sub-4m Super-Resolution Portal</span></h1><span className="font-mono text-[9px] text-warning">SIH PS ID: 26142 (NTRO)</span></div></div>
      <div className="hidden min-w-0 justify-center gap-5 lg:flex"><Status label="Copernicus API" value="Connected (Active)"/><Status label="GEE Compute" value="Online" tone="info"/><Status label="Inference Engine" value={cleanser.useLiveBackend ? "FastAPI Connected" : "RTX Ready (FP16)"}/></div>
      <div className="flex shrink-0 items-center gap-2"><select aria-label="Quick region selector" value={region} onChange={(event) => setRegion(event.target.value)} className="hidden h-9 max-w-48 rounded-md border border-border bg-background px-2 font-mono text-[10px] text-foreground outline-none focus:border-primary md:block">{regions.map((item) => <option key={item}>{item}</option>)}</select><Dialog.Root open={uploadOpen} onOpenChange={setUploadOpen}><Dialog.Trigger asChild><Button variant="outline"><Upload className="size-3.5"/><span className="hidden sm:inline">Upload GeoTIFF</span></Button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm"/><Dialog.Content className="glass-panel fixed left-1/2 top-1/2 z-[101] w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 p-5"><div className="mb-5 flex items-start justify-between"><div><Dialog.Title className="font-semibold">Ingest GeoTIFF Product</Dialog.Title><Dialog.Description className="mt-1 text-xs text-muted-foreground">Upload a georeferenced raster for SAR-guided cloud removal and local enhancement.</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon"><X className="size-4"/></Button></Dialog.Close></div><label className="flex h-40 cursor-pointer flex-col items-center justify-center border border-dashed border-primary/50 bg-primary/5 text-center transition-colors hover:bg-primary/10" onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files[0]; if (file && (file.name.endsWith('.tif') || file.name.endsWith('.tiff'))) { handleFileUpload(file); } }}><FileArchive className="mb-3 size-8 text-primary"/><span className="text-xs font-medium">Drop .tif or .tiff product</span><span className="mt-1 text-[10px] text-muted-foreground">COG · EPSG metadata · up to 2 GB</span><input ref={fileInputRef} type="file" accept=".tif,.tiff" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); }}/></label>{processing && <div className="mt-3"><div className="mb-1 flex justify-between font-mono text-[9px]"><span className="text-info">Processing upload…</span><span>{progress}%</span></div><div className="h-1 overflow-hidden bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }}/></div></div>}</Dialog.Content></Dialog.Portal></Dialog.Root></div>
    </header>

    <div className="relative min-h-0 flex-1 overflow-hidden">
      <Suspense fallback={<div className="grid size-full place-items-center font-mono text-xs text-primary"><LoaderCircle className="mr-2 size-4 animate-spin"/>INITIALIZING GEOSPATIAL CORE</div>}><GeoMap processed={processed} processing={processing} region={region} layers={layers} drawMode={drawMode} onDrawComplete={() => { setAoiReady(true); setDrawMode(null); }}/></Suspense>

      {!leftOpen && <Button size="icon" variant="outline" className="absolute left-3 top-3 z-40" aria-label="Open tasking panel" onClick={() => setLeftOpen(true)}><Menu className="size-4"/></Button>}
      <aside className={cn("glass-panel absolute inset-y-3 left-3 z-40 flex w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden transition-transform", !leftOpen && "-translate-x-[calc(100%+20px)]")}>
        <PanelHeader icon={Scan} title="Tasking & Ingestion" side="left" close={() => setLeftOpen(false)}/>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <p className="mb-2 font-mono text-[9px] uppercase text-muted-foreground">01 / Area of Interest</p>
          <Tabs.Root defaultValue="draw"><Tabs.List className="grid grid-cols-3 border border-border bg-background/60 p-0.5"><Tabs.Trigger value="draw" className="px-1 py-2 text-[9px] text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-info">Draw on Map</Tabs.Trigger><Tabs.Trigger value="bbox" className="px-1 py-2 text-[9px] text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-info">Coordinates</Tabs.Trigger><Tabs.Trigger value="demo" className="px-1 py-2 text-[9px] text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-info">Demo Sectors</Tabs.Trigger></Tabs.List>
            <Tabs.Content value="draw" className="mt-2 grid grid-cols-2 gap-2"><Button variant={drawMode === "box" ? "default" : "outline"} onClick={() => { setAoiReady(false); setDrawMode("box"); }}><BoxSelect className="size-3.5"/>Bounding Box</Button><Button variant={drawMode === "polygon" ? "default" : "outline"} onClick={() => { setAoiReady(false); setDrawMode("polygon"); }}><Pentagon className="size-3.5"/>Polygon</Button></Tabs.Content>
            <Tabs.Content value="bbox" className="mt-2 grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="font-mono text-[8px] text-muted-foreground">MIN LON (W)</label>
                <input value={bboxCoords[0]} onChange={(e) => setBboxCoords(prev => [parseFloat(e.target.value) || prev[0], prev[1], prev[2], prev[3]])} className="h-8 min-w-0 rounded border border-input bg-background px-2 font-mono text-[9px]"/>
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="font-mono text-[8px] text-muted-foreground">MIN LAT (S)</label>
                <input value={bboxCoords[1]} onChange={(e) => setBboxCoords(prev => [prev[0], parseFloat(e.target.value) || prev[1], prev[2], prev[3]])} className="h-8 min-w-0 rounded border border-input bg-background px-2 font-mono text-[9px]"/>
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="font-mono text-[8px] text-muted-foreground">MAX LON (E)</label>
                <input value={bboxCoords[2]} onChange={(e) => setBboxCoords(prev => [prev[0], prev[1], parseFloat(e.target.value) || prev[2], prev[3]])} className="h-8 min-w-0 rounded border border-input bg-background px-2 font-mono text-[9px]"/>
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="font-mono text-[8px] text-muted-foreground">MAX LAT (N)</label>
                <input value={bboxCoords[3]} onChange={(e) => setBboxCoords(prev => [prev[0], prev[1], prev[2], parseFloat(e.target.value) || prev[3]])} className="h-8 min-w-0 rounded border border-input bg-background px-2 font-mono text-[9px]"/>
              </div>
            </Tabs.Content>
            <Tabs.Content value="demo" className="mt-2"><select value={region} onChange={(e) => setRegion(e.target.value)} className="h-9 w-full rounded border border-input bg-background px-2 text-[10px]">{regions.slice(0,3).map((item) => <option key={item}>{item}</option>)}</select></Tabs.Content>
          </Tabs.Root>
          <div className="mt-3 flex items-center justify-between border border-primary/25 bg-primary/5 p-2"><div className="flex items-center gap-2"><CircleDot className="size-3 text-primary"/><span className="text-[10px]">AOI {aoiReady ? "locked · 14.82 km²" : "awaiting geometry"}</span></div><span className="font-mono text-[9px] text-primary">EPSG:4326</span></div>
          <div className="my-4 border-t border-border"/>

          {/* ── Cloud Cleanser Toggle ──────────────────────────────── */}
          <p className="mb-2 font-mono text-[9px] uppercase text-muted-foreground">02 / Pre-processing</p>
          <ToggleRow label="SAR-Guided Cloud Cleanser" checked={cloudCleanserEnabled} onCheckedChange={setCloudCleanserEnabled} metric="Sentinel-1 Inpainting · AUTO >10%"/>

          <div className="mt-3"><p className="mb-2 text-[10px] text-muted-foreground">MULTISPECTRAL BANDS</p><div className="grid grid-cols-4 gap-1.5">{Object.entries(bands).map(([band, active]) => <label key={band} className={cn("cursor-pointer border px-2 py-2 text-center font-mono text-[9px]", active ? "border-info/50 bg-info/10 text-info" : "border-border text-muted-foreground")}><input type="checkbox" checked={active} onChange={() => setBands((value) => ({...value, [band]: !active}))} className="sr-only"/>{band}<span className="block text-[8px] opacity-60">{band === "B02" ? "BLUE" : band === "B03" ? "GREEN" : band === "B04" ? "RED" : "NIR"}</span></label>)}</div></div>

          {/* ── Date Range Picker ──────────────────────────────────── */}
          <div className="mt-3"><div className="mb-2 flex justify-between text-[10px]"><span className="text-muted-foreground">DATE RANGE</span><span className="rounded border border-primary/30 px-1.5 text-primary">Latest · 24 SEP 2026</span></div><div className="grid grid-cols-2 gap-2"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 min-w-0 rounded border border-input bg-background px-2 font-mono text-[9px]"/><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 min-w-0 rounded border border-input bg-background px-2 font-mono text-[9px]"/></div></div>

          {/* ── Cloud Cleanser Results (inline) ────────────────────── */}
          {showCleanserResults && cleanserData && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 font-mono text-[9px] uppercase text-muted-foreground">
                Cloud Removal Results
              </p>
              <CloudCleanserResults
                data={cleanserData}
                visible={showCleanserResults}
                onClose={() => setShowCleanserResults(false)}
              />
            </div>
          )}
        </div>

        {/* ── Run Button ──────────────────────────────────────────── */}
        <div className="border-t border-border bg-background/55 p-3">
          <Button className="w-full" disabled={processing || !aoiReady} onClick={run}>
            {processing ? <LoaderCircle className="size-4 animate-spin"/> : <Zap className="size-4"/>}
            {processing
              ? (cloudCleanserEnabled ? "SAR Cloud Removal Processing" : "Processing Multi-Spectral Stack")
              : (cloudCleanserEnabled
                  ? "Run Cloud Removal (SAR-Guided)"
                  : "Run Super-Resolution (4× Enhance to 2.5m)"
                )}
          </Button>
          {(processing || processed) && <div className="mt-2"><div className="mb-1 flex justify-between font-mono text-[9px]"><span className={processed ? "text-primary" : "text-info"}>{processed ? "PRODUCT READY" : activeSteps[currentStep]}</span><span>{progress}%</span></div><div className="h-1 overflow-hidden bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }}/></div></div>}
          {cleanser.error && (
            <div className="mt-2 flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5">
              <AlertTriangle className="size-3 shrink-0 text-destructive"/>
              <span className="text-[9px] text-destructive">{cleanser.error}</span>
            </div>
          )}
        </div>
      </aside>

      {!rightOpen && <Button size="icon" variant="outline" className="absolute right-3 top-3 z-40" aria-label="Open analytics panel" onClick={() => setRightOpen(true)}><Activity className="size-4"/></Button>}
      <aside className={cn("glass-panel absolute inset-y-3 right-3 z-40 flex w-[min(350px,calc(100vw-24px))] flex-col overflow-hidden transition-transform", !rightOpen && "translate-x-[calc(100%+20px)]")}>
        <PanelHeader icon={Activity} title="Spectral & Downstream Intelligence" side="right" close={() => setRightOpen(false)}/>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="border border-primary/30 bg-primary/5 p-3"><div className="flex items-center justify-between"><div><p className="font-mono text-[9px] text-muted-foreground">RESOLUTION METRIC</p><p className="mt-1 text-lg font-semibold">10.0m <span className="text-muted-foreground">→</span> <span className="text-primary">2.5m</span></p></div><span className="rounded border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[9px] text-primary">4× SPATIAL UPSCALE</span></div></div>
          <p className="mb-2 mt-4 font-mono text-[9px] uppercase text-muted-foreground">Scientific Quality Scorecard</p>
          <div className="grid grid-cols-2 gap-2">{[["PSNR","33.4 dB",">32.5 dB","primary"],["SSIM","0.892",">0.880","info"],["SAM","3.8°","Spectral fidelity","warning"],["NDVI DRIFT","Δ 0.012","Zero corruption","primary"]].map(([name,value,target,color]) => <div key={name} className="border border-border bg-background/45 p-2.5"><div className="flex items-start justify-between"><div><p className="font-mono text-[8px] text-muted-foreground">{name}</p><p className="mt-1 text-sm font-semibold">{value}</p></div><MiniChart color={color as "primary" | "info" | "warning"}/></div><p className="mt-1 text-[8px] text-muted-foreground">TARGET: {target}</p></div>)}</div>

          {/* ── Cloud Cleanser Metrics (when active) ─────────────── */}
          {cleanserData && showCleanserResults && (
            <>
              <p className="mb-2 mt-4 font-mono text-[9px] uppercase text-muted-foreground">
                Cloud Removal Metrics
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-border bg-background/45 p-2.5">
                  <p className="font-mono text-[8px] text-muted-foreground">CLOUD COVER</p>
                  <p className={cn(
                    "mt-1 text-sm font-semibold",
                    cleanserData.cloudCoverage > 70 ? "text-destructive" :
                    cleanserData.cloudCoverage > 30 ? "text-warning" : "text-primary",
                  )}>
                    {cleanserData.cloudCoverage.toFixed(1)}%
                  </p>
                  <p className="mt-1 text-[8px] text-muted-foreground">QA60 pixel mask</p>
                </div>
                <div className="border border-border bg-background/45 p-2.5">
                  <p className="font-mono text-[8px] text-muted-foreground">INFERENCE</p>
                  <p className="mt-1 text-sm font-semibold text-info">{cleanserData.inferenceTime.toFixed(2)}s</p>
                  <p className="mt-1 text-[8px] text-muted-foreground">Cross-Attention SAR</p>
                </div>
              </div>
            </>
          )}

          <p className="mb-1 mt-4 font-mono text-[9px] uppercase text-muted-foreground">Intelligence Layers</p>
          <ToggleRow label="Epistemic Uncertainty Heatmap" checked={layers.uncertainty} onCheckedChange={(v) => setLayers({...layers, uncertainty:v})} metric="Pixel-level model reliability"/><ToggleRow label="Vegetation Index (NDVI)" checked={layers.ndvi} onCheckedChange={(v) => setLayers({...layers, ndvi:v})}/><ToggleRow label="Water Index (NDWI)" checked={layers.ndwi} onCheckedChange={(v) => setLayers({...layers, ndwi:v})}/><ToggleRow label="Downstream AI Extraction" checked={layers.extraction} onCheckedChange={(v) => setLayers({...layers, extraction:v})} metric="YOLOv8-OBB · +28% mIoU GAIN"/>
          <div className="mt-4 border border-border bg-background/40 p-3"><div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground">Viewport objects</span><span className="font-mono text-[10px] text-info">LIVE</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div><b className="block text-base">184</b><span className="text-[8px] text-muted-foreground">BUILDINGS</span></div><div><b className="block text-base">12.7</b><span className="text-[8px] text-muted-foreground">KM ROADS</span></div><div><b className="block text-base">96.4%</b><span className="text-[8px] text-muted-foreground">CONFIDENCE</span></div></div></div>
        </div>
        <div className="grid gap-1.5 border-t border-border bg-background/55 p-3"><Button variant="outline" className="justify-start" onClick={() => { if (cleanserData?.downloadUrl) window.open(cleanserData.downloadUrl, "_blank"); }}><Download className="size-3.5 text-primary"/>Download 2.5m GeoTIFF <span className="ml-auto text-[8px] text-muted-foreground">COG + CRS</span></Button><Button variant="outline" className="justify-start"><Layers3 className="size-3.5 text-info"/>Export Vector GeoJSON</Button><Button variant="amber" className="justify-start"><FileDown className="size-3.5"/>Generate NTRO Analytical PDF</Button></div>
      </aside>

      <div className="absolute left-1/2 top-3 z-30 hidden -translate-x-1/2 items-center gap-3 rounded border border-border bg-background/80 px-3 py-1.5 font-mono text-[9px] text-muted-foreground backdrop-blur lg:flex"><Radio className="size-3 text-primary"/><span>ORB S2A · PASS 27411</span><span className={cn("transition-colors", showCleanserResults && cleanserData ? (cleanserData.cloudCoverage > 50 ? "text-destructive" : "text-warning") : "text-info")}>CLOUD {showCleanserResults && cleanserData ? `${cleanserData.cloudCoverage.toFixed(1)}%` : "7.4%"}</span><span>SUN AZ 132.7°</span></div>
      <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded border border-border bg-background/80 px-3 py-1.5 font-mono text-[9px] text-muted-foreground backdrop-blur"><ServerCog className="size-3 text-primary"/><span>{cloudCleanserEnabled ? "CLOUD CLEANSER v1.0" : "MODEL HAT-SR v2.4.1"}</span><span className="hidden sm:inline">·</span><span className="hidden text-info sm:inline">TILE CACHE 99.8%</span><CloudCog className="hidden size-3 text-warning sm:block"/></div>
    </div>
  </main>;
}