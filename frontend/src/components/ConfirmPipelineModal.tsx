import React from 'react';
import { X, CheckCircle2, ShieldCheck, ArrowRight, Layers } from 'lucide-react';

interface ConfirmPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mode: 'upload' | 'map_mark' | 'manual';
  coordinates: string;
  uploadedFileName?: string | null;
  groundAreaKm2?: number;
}

export const ConfirmPipelineModal: React.FC<ConfirmPipelineModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  mode,
  coordinates,
  uploadedFileName,
  groundAreaKm2 = 64.8,
}) => {
  if (!isOpen) return null;

  const modeLabels = {
    upload: 'User Uploaded GeoTIFF (.tif)',
    map_mark: 'Marked Map AOI Bounding Box',
    manual: 'Manual Polygon Coordinates',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#0b1322] border border-slate-700/90 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden text-slate-200 font-sans">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#070c16] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-blue-900/60 border border-blue-600/50 rounded-lg text-blue-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-white tracking-tight leading-tight">
                Confirm Pipeline Execution & GeoTIFF Processing
              </h3>
              <p className="text-[11px] text-slate-400">
                AuraClear 10-Channel Cloud Cleanser &bull; AuraClear-SR (3&times; Sub-4m Upscaler)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 text-[12.5px]">
          {/* Input Source Summary */}
          <div className="bg-[#0f1a2e] border border-slate-700/80 rounded-lg p-3.5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Input Source Mode</span>
              <span className="font-semibold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60 text-[11px]">
                {modeLabels[mode]}
              </span>
            </div>

            {mode === 'upload' ? (
              <div className="flex justify-between items-center text-[12px] pt-1 border-t border-slate-800">
                <span className="text-slate-400">Target File</span>
                <span className="font-mono text-emerald-400 font-semibold truncate max-w-[280px]">
                  {uploadedFileName || 'sample_sentinel2_multiband.tif'}
                </span>
              </div>
            ) : (
              <div className="space-y-1 pt-1 border-t border-slate-800">
                <span className="text-slate-400 block text-[11px]">Target Bounding Box (EPSG:4326)</span>
                <div className="font-mono text-[11px] text-slate-300 bg-slate-950/80 p-2 rounded border border-slate-800 break-all leading-relaxed">
                  {coordinates.replace(/\n/g, ' ')}
                </div>
              </div>
            )}
          </div>

          {/* 3x Super-Resolution Limit & Coverage Validation */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#0f1a2e] border border-slate-700/80 rounded-lg p-3 text-center">
              <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider block">
                Target Ground Coverage
              </span>
              <span className="text-[16px] font-bold text-white mt-0.5 block">
                ~ {groundAreaKm2.toFixed(1)} sq. km
              </span>
              <span className="text-[10.5px] text-emerald-400 font-medium mt-0.5 block flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Within 3&times; SR Limit</span>
              </span>
            </div>

            <div className="bg-[#0f1a2e] border border-slate-700/80 rounded-lg p-3 text-center">
              <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider block">
                Resolution Scaling (GSD)
              </span>
              <span className="text-[16px] font-bold text-sky-400 mt-0.5 block">
                10m &rarr; 3.33m
              </span>
              <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                9&times; Pixel Density Multiplier
              </span>
            </div>
          </div>

          {/* Planned Output Products */}
          <div className="border border-slate-700/70 rounded-lg overflow-hidden text-[11.5px]">
            <div className="bg-[#080e18] px-3.5 py-1.5 font-semibold text-slate-300 flex items-center justify-between border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-400" />
                <span>Planned Generated Outputs</span>
              </span>
              <span className="text-[10px] text-emerald-400">4 Stages + GeoTIFF</span>
            </div>
            <div className="divide-y divide-slate-800/80 bg-[#0d1728] p-1">
              <div className="px-2.5 py-1 flex justify-between text-slate-300">
                <span>1. Live Optical (Cloudy Sentinel-2)</span>
                <span className="font-mono text-slate-400">10m GSD PNG</span>
              </div>
              <div className="px-2.5 py-1 flex justify-between text-slate-300">
                <span>2. Sentinel-1 SAR Radar (VV Polarization)</span>
                <span className="font-mono text-slate-400">10m GSD PNG</span>
              </div>
              <div className="px-2.5 py-1 flex justify-between text-slate-300">
                <span>3. AuraClear Reconstructed (Cloud-Free)</span>
                <span className="font-mono text-slate-400">10m GSD PNG</span>
              </div>
              <div className="px-2.5 py-1 flex justify-between text-slate-300">
                <span>4. AuraClear-SR Sub-4m Super-Resolved</span>
                <span className="font-mono text-sky-400 font-semibold">3.33m Sub-4m PNG</span>
              </div>
              <div className="px-2.5 py-1 flex justify-between text-slate-300">
                <span>5. Multi-Band Radiometric GeoTIFF</span>
                <span className="font-mono text-emerald-400 font-semibold">EPSG:4326 (.tif)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="px-5 py-3.5 bg-[#070c16] border-t border-slate-800 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-md font-medium text-[12.5px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-[#1a56db] hover:bg-[#1546b3] text-white rounded-md font-semibold text-[12.5px] shadow-md transition-all flex items-center space-x-2"
          >
            <span>Confirm &amp; Run Pipeline</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
