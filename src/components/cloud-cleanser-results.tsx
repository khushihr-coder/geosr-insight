/**
 * CloudCleanserResults — Synchronized 3-Panel Inspection View
 *
 * Displays the SAR-guided cloud removal results in a premium split-panel
 * layout with animated transitions.  All data is deterministic mock data
 * kept client-side per AGENTS.md design rules.
 */

import {
  Cloud,
  CloudOff,
  Download,
  Maximize2,
  Radar,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────────────────── */

export interface CloudCleanserData {
  cloudCoverage: number;
  dateS2: string;
  dateS1: string;
  inferenceTime: number;
  cloudyUrl: string;
  sarUrl: string;
  cleanUrl: string;
  downloadUrl: string | null;
}

interface Props {
  data: CloudCleanserData | null;
  visible: boolean;
  onClose: () => void;
}

/* ── Canvas helpers: render deterministic mock satellite imagery ──── */

function drawMockCloudy(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  // Teal-ish terrain base
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const noise = Math.sin(x * 0.04 + y * 0.02) * 0.5 + 0.5;
      const g = 35 + noise * 60;
      const r = 20 + noise * 30;
      const b = 25 + noise * 35;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  // Cloud blobs (white/grey)
  const clouds = [
    { cx: w * 0.3, cy: h * 0.25, rx: w * 0.22, ry: h * 0.14 },
    { cx: w * 0.65, cy: h * 0.55, rx: w * 0.28, ry: h * 0.18 },
    { cx: w * 0.5, cy: h * 0.7, rx: w * 0.15, ry: h * 0.12 },
    { cx: w * 0.15, cy: h * 0.6, rx: w * 0.18, ry: h * 0.10 },
    { cx: w * 0.8, cy: h * 0.2, rx: w * 0.16, ry: h * 0.11 },
  ];
  clouds.forEach(({ cx, cy, rx, ry }) => {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    grad.addColorStop(0, "rgba(235,235,240,0.92)");
    grad.addColorStop(0.5, "rgba(210,215,225,0.7)");
    grad.addColorStop(1, "rgba(200,200,210,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawMockSAR(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  // SAR-like grainy grayscale radar image
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const structure = Math.sin(x * 0.03 + y * 0.015) * 0.3 +
                        Math.cos(x * 0.02 - y * 0.04) * 0.2 + 0.5;
      const speckle = (Math.sin(x * 13.7 + y * 17.3) * 0.5 + 0.5) * 0.15;
      const val = Math.max(0, Math.min(1, structure + speckle));
      const g = Math.round(val * 180 + 20);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

function drawMockClean(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  // Clean terrain — more vibrant, no clouds
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const noise = Math.sin(x * 0.04 + y * 0.02) * 0.5 + 0.5;
      const field = Math.sin(x * 0.015 + y * 0.008) * 0.5 + 0.5;
      const g = 45 + noise * 80 + field * 30;
      const r = 25 + noise * 40 + field * 15;
      const b = 20 + noise * 25;
      ctx.fillStyle = `rgb(${Math.min(r, 255)},${Math.min(g, 255)},${Math.min(b, 255)})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

/* ── Cloud Badge ───────────────────────────────────────────────────── */

function CloudBadge({ pct }: { pct: number }) {
  const tone = pct > 70 ? "destructive" : pct > 30 ? "warning" : "primary";
  const colors: Record<string, string> = {
    destructive:
      "border-destructive/60 bg-destructive/15 text-destructive shadow-[0_0_12px_var(--color-destructive)]",
    warning:
      "border-warning/60 bg-warning/15 text-warning shadow-[0_0_12px_var(--color-warning)]",
    primary:
      "border-primary/60 bg-primary/15 text-primary shadow-[0_0_12px_var(--color-primary)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs font-bold transition-all",
        colors[tone],
      )}
    >
      <Cloud className="size-3.5" />
      {pct.toFixed(1)}% Cloudy
    </span>
  );
}

/* ── Panel Card ────────────────────────────────────────────────────── */

function PanelCard({
  title,
  subtitle,
  icon: Icon,
  drawFn,
  imageUrl,
  accentColor,
  delay,
}: {
  title: string;
  subtitle: string;
  icon: typeof Cloud;
  drawFn: (canvas: HTMLCanvasElement) => void;
  imageUrl: string | null;
  accentColor: string;
  delay: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!canvasRef.current) return;
    canvasRef.current.width = 384;
    canvasRef.current.height = 288;
    if (imageUrl) {
      // If we have a real image URL (from backend), load it
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx && canvasRef.current) {
          ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      };
      img.src = imageUrl;
    } else {
      drawFn(canvasRef.current);
    }
  }, [drawFn, imageUrl]);

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border transition-all duration-700",
        revealed
          ? "translate-y-0 border-border opacity-100"
          : "translate-y-4 border-transparent opacity-0",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-surface/80 px-3 py-2">
        <Icon className={cn("size-3.5 shrink-0", accentColor)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider">
            {title}
          </p>
          <p className="truncate font-mono text-[8px] text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <Maximize2 className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70" />
      </div>

      {/* Image */}
      <div className="relative aspect-[4/3] bg-black/40">
        <canvas
          ref={canvasRef}
          className="size-full object-cover"
          style={{ imageRendering: "pixelated" }}
        />
        {/* Scanline effect */}
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.04)_2px,rgba(0,0,0,0.04)_4px)]" />
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */

export function CloudCleanserResults({ data, visible, onClose }: Props) {
  if (!visible || !data) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-3 duration-500">
      {/* Metrics Bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface/70 px-2.5 py-2">
          <CloudBadge pct={data.cloudCoverage} />
        </div>
        <div className="flex flex-col justify-center rounded-md border border-border bg-surface/70 px-2.5 py-2">
          <span className="font-mono text-[8px] uppercase text-muted-foreground">
            S2 Optical
          </span>
          <span className="font-mono text-[10px] text-info">{data.dateS2}</span>
        </div>
        <div className="flex flex-col justify-center rounded-md border border-border bg-surface/70 px-2.5 py-2">
          <span className="font-mono text-[8px] uppercase text-muted-foreground">
            S1 SAR Offset
          </span>
          <span className="font-mono text-[10px] text-primary">{data.dateS1}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface/70 px-2.5 py-2">
          <Timer className="size-3 text-warning" />
          <div>
            <span className="font-mono text-[8px] uppercase text-muted-foreground">
              Inference
            </span>
            <span className="block font-mono text-[10px] text-warning">
              {data.inferenceTime.toFixed(2)}s
            </span>
          </div>
        </div>
      </div>

      {/* 3-Panel View */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <PanelCard
          title="Cloudy Sentinel-2"
          subtitle="RAW RGB · 10m GSD"
          icon={Cloud}
          drawFn={drawMockCloudy}
          imageUrl={data.cloudyUrl}
          accentColor="text-warning"
          delay={100}
        />
        <PanelCard
          title="SAR Radar (VV)"
          subtitle="Sentinel-1 IW · Microwave"
          icon={Radar}
          drawFn={drawMockSAR}
          imageUrl={data.sarUrl}
          accentColor="text-muted-foreground"
          delay={300}
        />
        <PanelCard
          title="AI Cloud-Free"
          subtitle="Reconstructed · Cross-Attention"
          icon={CloudOff}
          drawFn={drawMockClean}
          imageUrl={data.cleanUrl}
          accentColor="text-primary"
          delay={500}
        />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="flex-1 justify-center"
          onClick={() => {
            if (data.downloadUrl) {
              window.open(data.downloadUrl, "_blank");
            }
          }}
        >
          <Download className="size-3.5 text-primary" />
          Download 10m Cloud-Free GeoTIFF
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
