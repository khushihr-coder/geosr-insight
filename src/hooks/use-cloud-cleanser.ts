/**
 * useCloudCleanser — API client hook for the Cloud Cleanser FastAPI backend.
 *
 * Per AGENTS.md: "Keep the 2.5-second processing workflow and exports
 * client-side with deterministic mock data; the requested experience
 * explicitly requires no live backend."
 *
 * This hook defaults to client-side mock data with the 2.5s animation.
 * When `VITE_CLOUD_API_URL` is set, it transparently switches to the
 * real FastAPI backend at that URL.
 */

import { useCallback, useRef, useState } from "react";

import type { CloudCleanserData } from "@/components/cloud-cleanser-results";

const API_BASE = import.meta.env.VITE_CLOUD_API_URL ?? "";

interface ProcessPolygonParams {
  bbox?: [number, number, number, number];
  geojson?: object;
  startDate?: string;
  endDate?: string;
}

interface UploadParams {
  file: File;
  onProgress?: (pct: number) => void;
}

interface HealthStatus {
  status: string;
  device: string;
  model_loaded: boolean;
  checkpoint: string;
  gpu: {
    cuda_available: boolean;
    device_name: string;
    vram_allocated_mb: number;
    vram_reserved_mb?: number;
  };
}

/* ── Deterministic mock results ─────────────────────────────────────── */

function createMockResult(overrides?: Partial<CloudCleanserData>): CloudCleanserData {
  return {
    cloudCoverage: 87.4,
    dateS2: "2026-09-24",
    dateS1: "2026-09-22",
    inferenceTime: 2.48,
    cloudyUrl: "",       // empty → uses canvas mock rendering
    sarUrl: "",
    cleanUrl: "",
    downloadUrl: null,   // null → no real file to download in mock mode
    ...overrides,
  };
}

/* ── Hook ───────────────────────────────────────────────────────────── */

export function useCloudCleanser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CloudCleanserData | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const useLiveBackend = !!API_BASE;

  /* ── Process Polygon ───────────────────────────────────────────── */
  const processPolygon = useCallback(
    async (params: ProcessPolygonParams) => {
      setLoading(true);
      setError(null);
      setResult(null);
      setProgress(0);

      try {
        if (useLiveBackend) {
          // Real backend call
          abortRef.current = new AbortController();
          const form = new FormData();
          if (params.bbox) form.append("bbox", params.bbox.join(","));
          if (params.geojson) form.append("geojson", JSON.stringify(params.geojson));
          if (params.startDate) form.append("start_date", params.startDate);
          if (params.endDate) form.append("end_date", params.endDate);

          // Simulate progress while waiting
          const progressTimer = window.setInterval(
            () => setProgress((p) => Math.min(p + 3, 90)),
            200,
          );

          const res = await fetch(`${API_BASE}/api/process-polygon`, {
            method: "POST",
            body: form,
            signal: abortRef.current.signal,
          });

          clearInterval(progressTimer);

          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || "Processing failed");
          }

          const json = await res.json();
          setProgress(100);
          setResult({
            cloudCoverage: json.cloud_coverage_percentage,
            dateS2: json.acquisition_date_s2,
            dateS1: json.acquisition_date_s1,
            inferenceTime: json.inference_time_seconds,
            cloudyUrl: json.previews.cloudy,
            sarUrl: json.previews.sar_vv,
            cleanUrl: json.previews.cloud_free,
            downloadUrl: `${API_BASE}${json.download_url}`,
          });
        } else {
          // Client-side mock with 2.5s animation (per AGENTS.md)
          const interval = window.setInterval(
            () => setProgress((p) => Math.min(p + 4, 100)),
            100,
          );
          await new Promise((resolve) => setTimeout(resolve, 2500));
          clearInterval(interval);
          setProgress(100);
          setResult(createMockResult());
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [useLiveBackend],
  );

  /* ── Upload GeoTIFF ────────────────────────────────────────────── */
  const uploadGeoTIFF = useCallback(
    async (params: UploadParams) => {
      setLoading(true);
      setError(null);
      setResult(null);
      setProgress(0);

      try {
        if (useLiveBackend) {
          abortRef.current = new AbortController();
          const form = new FormData();
          form.append("file", params.file);

          const progressTimer = window.setInterval(
            () => setProgress((p) => Math.min(p + 2, 85)),
            200,
          );

          const res = await fetch(`${API_BASE}/api/upload-geotiff`, {
            method: "POST",
            body: form,
            signal: abortRef.current.signal,
          });

          clearInterval(progressTimer);

          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || "Upload processing failed");
          }

          const json = await res.json();
          setProgress(100);
          setResult({
            cloudCoverage: json.cloud_coverage_percentage,
            dateS2: json.acquisition_date_s2,
            dateS1: json.acquisition_date_s1,
            inferenceTime: json.inference_time_seconds,
            cloudyUrl: json.previews.cloudy,
            sarUrl: json.previews.sar_vv,
            cleanUrl: json.previews.cloud_free,
            downloadUrl: `${API_BASE}${json.download_url}`,
          });
        } else {
          // Mock upload experience
          const interval = window.setInterval(
            () => setProgress((p) => Math.min(p + 4, 100)),
            100,
          );
          await new Promise((resolve) => setTimeout(resolve, 2500));
          clearInterval(interval);
          setProgress(100);
          setResult(
            createMockResult({
              cloudCoverage: 64.2,
              dateS2: "uploaded",
              dateS1: "auto-fetched",
            }),
          );
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [useLiveBackend],
  );

  /* ── Health Check ──────────────────────────────────────────────── */
  const checkHealth = useCallback(async (): Promise<HealthStatus | null> => {
    if (!useLiveBackend) {
      return {
        status: "ok",
        device: "mock",
        model_loaded: true,
        checkpoint: "cloud_cleanser_latest.pth",
        gpu: {
          cuda_available: true,
          device_name: "RTX 3050 Laptop GPU (mock)",
          vram_allocated_mb: 0,
        },
      };
    }
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }, [useLiveBackend]);

  /* ── Cancel ────────────────────────────────────────────────────── */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setProgress(0);
  }, []);

  return {
    loading,
    error,
    result,
    progress,
    processPolygon,
    uploadGeoTIFF,
    checkHealth,
    cancel,
    clearResult: () => setResult(null),
    useLiveBackend,
  };
}
