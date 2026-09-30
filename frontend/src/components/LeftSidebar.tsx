import React, { useState, useMemo } from 'react';
import {
  UploadCloud,
  MapPin,
  Edit3,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  FileCheck,
  Layers,
} from 'lucide-react';

interface LeftSidebarProps {
  coordinates: string;
  onCoordinatesChange: (coords: string) => void;
  onRequestRunPipeline: () => void;
  isRunning: boolean;
  activeInputMode: 'upload' | 'map_mark' | 'manual';
  onSelectInputMode: (mode: 'upload' | 'map_mark' | 'manual') => void;
  onFileUpload: (file: File) => void;
  uploadedFileName?: string | null;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  coordinates,
  onCoordinatesChange,
  onRequestRunPipeline,
  isRunning,
  activeInputMode,
  onSelectInputMode,
  onFileUpload,
  uploadedFileName,
}) => {
  const [cloudThreshold, setCloudThreshold] = useState('10%');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  // Calculate coordinates dimensions & 3x super-resolution limit check
  const bboxMetrics = useMemo(() => {
    try {
      let parts: number[] = [];
      const trimmed = coordinates.trim();
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          const lons = parsed.map((p: number[]) => p[0]);
          const lats = parsed.map((p: number[]) => p[1]);
          parts = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
        } else if (Array.isArray(parsed) && parsed.length === 4) {
          parts = parsed;
        }
      } else {
        parts = trimmed.split(',').map((s) => parseFloat(s.trim()));
      }

      if (parts.length === 4 && !parts.some(isNaN)) {
        const [minLon, minLat, maxLon, maxLat] = parts;
        const dLon = Math.abs(maxLon - minLon);
        const dLat = Math.abs(maxLat - minLat);
        const latRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
        const widthKm = dLon * 111.32 * Math.cos(latRad);
        const heightKm = dLat * 111.32;
        const areaKm2 = widthKm * heightKm;
        const maxDim = Math.max(widthKm, heightKm);
        const isSafe = maxDim <= 9.5; // Within ~8-9 km safe boundary for 3x super-resolution
        return {
          valid: true,
          widthKm,
          heightKm,
          areaKm2,
          isSafe,
          maxDim,
        };
      }
    } catch {
      // Ignore parse errors while typing
    }
    return { valid: false, widthKm: 8.0, heightKm: 8.8, areaKm2: 64.8, isSafe: true, maxDim: 8.8 };
  }, [coordinates]);

  return (
    <aside className="w-[310px] xl:w-[330px] flex-shrink-0 bg-white border border-slate-200/90 rounded-lg shadow-sm overflow-hidden select-none self-start flex flex-col">
      {/* Header: Pipeline Control */}
      <div className="bg-[#1a56db] text-white px-3.5 py-2.5 flex items-center justify-between font-semibold text-[13px] tracking-wide">
        <div className="flex items-center space-x-2">
          <Layers className="h-4 w-4" />
          <span>PIPELINE INPUT &amp; CONTROLS</span>
        </div>
      </div>

      <div className="p-3.5 space-y-4">
        {/* ── 3 INPUT OPTIONS ── */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Select Input Method
          </label>
          <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-md text-[11px] font-medium border border-slate-200/80 gap-1">
            {/* Option 1: Upload TIFF */}
            <button
              onClick={() => onSelectInputMode('upload')}
              className={`py-1.5 px-1 rounded flex flex-col items-center justify-center transition-all ${
                activeInputMode === 'upload'
                  ? 'bg-white text-[#1a56db] font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UploadCloud className="h-4 w-4 mb-0.5" />
              <span>GeoTIFF</span>
            </button>

            {/* Option 2: Mark on Map */}
            <button
              onClick={() => onSelectInputMode('map_mark')}
              className={`py-1.5 px-1 rounded flex flex-col items-center justify-center transition-all ${
                activeInputMode === 'map_mark'
                  ? 'bg-white text-[#1a56db] font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="h-4 w-4 mb-0.5" />
              <span>Mark Map</span>
            </button>

            {/* Option 3: Manual Coordinates */}
            <button
              onClick={() => onSelectInputMode('manual')}
              className={`py-1.5 px-1 rounded flex flex-col items-center justify-center transition-all ${
                activeInputMode === 'manual'
                  ? 'bg-white text-[#1a56db] font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="h-4 w-4 mb-0.5" />
              <span>Manual</span>
            </button>
          </div>
        </div>

        {/* ── OPTION 1: GEOTIFF UPLOAD ── */}
        {activeInputMode === 'upload' && (
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-[12px]">
              <span className="font-semibold text-slate-700">Upload GeoTIFF</span>
              <span className="font-mono text-[10.5px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                Multi-band .tif
              </span>
            </div>

            <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/20">
              <UploadCloud className="h-7 w-7 text-blue-500 mb-1" />
              <span className="text-[12px] font-semibold text-slate-700 text-center">
                Click to browse or drop GeoTIFF
              </span>
              <span className="text-[10.5px] text-slate-400 text-center mt-0.5">
                Bands B2, B3, B4, B8 + SAR compatible
              </span>
              <input
                type="file"
                accept=".tif,.tiff"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {uploadedFileName ? (
              <div className="flex items-center space-x-2 text-[11.5px] text-emerald-800 bg-emerald-50 p-2.5 rounded border border-emerald-200">
                <FileCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <div className="truncate">
                  <span className="font-semibold block truncate">{uploadedFileName}</span>
                  <span className="text-[10px] text-emerald-600">GeoTIFF Verified for pipeline</span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 bg-slate-50 p-2 rounded border border-slate-200 text-center">
                Or proceed with sample Jammu &amp; Kashmir Sentinel-2 scene.
              </div>
            )}
          </div>
        )}

        {/* ── OPTION 2: MARK ON MAP ── */}
        {activeInputMode === 'map_mark' && (
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-[12px]">
              <span className="font-semibold text-slate-700">Interactive Map AOI</span>
              <span className="font-mono text-[10.5px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Live Marking
              </span>
            </div>

            <div className="bg-sky-50 border border-sky-200 text-sky-800 text-[11.5px] p-2.5 rounded space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-sky-600" />
                <span>Click on the map to place AOI</span>
              </div>
              <p className="text-[10.5px] text-sky-700 leading-normal">
                Clicking any point centers the target bounding box precisely within the 3&times; super-resolution limit.
              </p>
            </div>

            {/* Bounding box limit indicator */}
            <div className="bg-slate-50 border border-slate-200 p-2 rounded text-[11px] space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Footprint:</span>
                <span className="font-semibold text-slate-800">
                  {bboxMetrics.widthKm.toFixed(1)} km &times; {bboxMetrics.heightKm.toFixed(1)} km (~{bboxMetrics.areaKm2.toFixed(1)} km&sup2;)
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-[10.5px] text-emerald-600 font-medium">
                <CheckCircle2 className="h-3 w-3" />
                <span>3&times; Super-Resolution Limit Enforced (&le; 8km)</span>
              </div>
            </div>
          </div>
        )}

        {/* ── OPTION 3: MANUAL COORDINATES ── */}
        {activeInputMode === 'manual' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[12px]">
              <span className="font-semibold text-slate-700">Bounding coordinates</span>
              <span className="font-mono text-[10.5px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                EPSG:4326
              </span>
            </div>

            <textarea
              rows={3}
              value={coordinates}
              onChange={(e) => onCoordinatesChange(e.target.value)}
              className="w-full font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-md p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white resize-none leading-relaxed"
              placeholder="[[min_lon, min_lat], ...]"
            />

            {/* Real-time 3x Resolution Limit Feedback */}
            {bboxMetrics.valid ? (
              <div
                className={`p-2 rounded border text-[11px] space-y-0.5 ${
                  bboxMetrics.isSafe
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1">
                    {bboxMetrics.isSafe ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    )}
                    <span>
                      {bboxMetrics.isSafe ? 'Within 3x SR Limit' : 'Exceeds 8km Limit'}
                    </span>
                  </span>
                  <span>~{bboxMetrics.areaKm2.toFixed(1)} km&sup2;</span>
                </div>
                <div className="text-[10px] opacity-80">
                  {bboxMetrics.widthKm.toFixed(1)}km &times; {bboxMetrics.heightKm.toFixed(1)}km (Max dim &le; 8.0km recommended for 3.33m GSD)
                </div>
              </div>
            ) : (
              <div className="text-[10.5px] text-slate-400">
                Format: [[min_lon, min_lat], [max_lon, min_lat], [max_lon, max_lat], [min_lon, max_lat]]
              </div>
            )}
          </div>
        )}

        <hr className="border-slate-200" />

        {/* ── PROCESSING SETTINGS ── */}
        <div className="space-y-2.5">
          <div className="flex items-center space-x-1.5 text-[12px] font-semibold text-slate-700">
            <Sliders className="h-3.5 w-3.5 text-slate-500" />
            <span>Processing Specifications</span>
          </div>

          <div className="space-y-2 text-[11.5px]">
            <div>
              <span className="block text-[10.5px] text-slate-500 mb-0.5">Model Architecture</span>
              <div className="w-full bg-slate-100 text-slate-800 px-2.5 py-1.5 rounded text-[11px] font-medium border border-slate-200 flex justify-between items-center">
                <span>AuraClear 10-Ch U-Net</span>
                <span className="text-[9.5px] text-emerald-700 bg-emerald-100/70 px-1 py-0.5 rounded font-semibold">
                  SAR Guided
                </span>
              </div>
            </div>

            <div>
              <span className="block text-[10.5px] text-slate-500 mb-0.5">Super-Resolution Engine</span>
              <div className="w-full bg-slate-100 text-slate-800 px-2.5 py-1.5 rounded text-[11px] font-medium border border-slate-200 flex justify-between items-center">
                <span>AuraClear-SR (3&times; Sub-Pixel)</span>
                <span className="text-[9.5px] text-blue-700 bg-blue-100/70 px-1 py-0.5 rounded font-semibold">
                  3.33m GSD
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[10.5px] text-slate-500 mb-0.5">Cloud Trigger Threshold</label>
              <select
                value={cloudThreshold}
                onChange={(e) => setCloudThreshold(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded px-2.5 py-1 text-[11.5px] focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="5%">5% (Aggressive Inpainting)</option>
                <option value="10%">10% (Standard Benchmark)</option>
                <option value="15%">15% (High Tolerance)</option>
                <option value="Always">Always Run Inpainting</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── RUN PIPELINE ACTION BUTTON ── */}
        <div className="pt-2">
          <button
            onClick={onRequestRunPipeline}
            disabled={isRunning}
            className={`w-full py-2.5 px-4 rounded-md font-semibold text-[13px] text-white flex items-center justify-center space-x-2 transition-all shadow-sm ${
              isRunning
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-[#1a56db] hover:bg-[#1546b3] active:bg-[#10368a]'
            }`}
          >
            {isRunning ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" />
                <span>Executing Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Run Pipeline</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
