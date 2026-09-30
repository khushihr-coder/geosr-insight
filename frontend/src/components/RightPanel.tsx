import React from 'react';
import {
  Info,
  Download,
  CheckCircle2,
  FileCode,
  Gauge,
  Calendar,
  CloudSun,
} from 'lucide-react';

interface RightPanelProps {
  coordinates: string;
  onViewResults: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  coordinates,
  onViewResults,
}) => {
  return (
    <aside className="w-[300px] xl:w-[320px] flex-shrink-0 bg-white border border-slate-200/90 rounded-lg shadow-sm p-4 select-none self-start flex flex-col justify-between space-y-4">
      {/* Target AOI & Resolution Metrics */}
      <div>
        <div className="flex items-center space-x-2 text-slate-800 font-semibold text-[13.5px] mb-3">
          <Info className="h-4 w-4 text-[#1a56db]" />
          <span>Pipeline & Ground Metrics</span>
        </div>

        <div className="space-y-2.5 text-[12px]">
          <div>
            <span className="text-slate-400 block text-[10.5px] font-semibold uppercase tracking-wider mb-0.5">
              Target Bounding Box (EPSG:4326)
            </span>
            <div className="font-mono text-slate-700 text-[11px] bg-slate-50 p-2 rounded border border-slate-200 break-all leading-relaxed">
              {coordinates}
            </div>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-100">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-slate-400" />
              <span>Input Ground Resolution</span>
            </span>
            <span className="font-semibold text-slate-800">10.0m GSD (Native)</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-100">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-blue-500" />
              <span>Super-Resolved Resolution</span>
            </span>
            <span className="font-semibold text-blue-700">3.33m GSD (Sub-4m)</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-100">
            <span className="text-slate-500">Pixel Multiplier</span>
            <span className="font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
              9&times; Density (3&times;3)
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-100">
            <span className="text-slate-500">Ground Footprint</span>
            <span className="font-semibold text-slate-800">~ 64.8 sq. km</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-100">
            <span className="text-slate-500 flex items-center gap-1.5">
              <CloudSun className="h-3.5 w-3.5 text-amber-500" />
              <span>Measured Cloud Cover</span>
            </span>
            <span className="font-semibold text-amber-600">18.4% (&gt; 10% Thresh)</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-100">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>Optical S2 Date</span>
            </span>
            <span className="font-medium text-slate-800">28 Sep 2024</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-100">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>SAR S1 Date</span>
            </span>
            <span className="font-medium text-slate-800">25 Sep 2024</span>
          </div>
        </div>

        {/* Status check badge */}
        <div className="mt-3.5 bg-emerald-50 border border-emerald-200 rounded p-2 flex items-center space-x-2 text-[11.5px] text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>AuraClear + Sub-4m Inpainted Output Ready</span>
        </div>
      </div>

      {/* Quick Download Section */}
      <div className="pt-2 border-t border-slate-200 space-y-2">
        <a
          href="/outputs/cloud_free.tif"
          download="GeoLens_CloudFree_Sub4m.tif"
          className="w-full py-2 px-3 bg-[#eff6ff] hover:bg-[#dbeafe] active:bg-[#bfdbfe] text-[#1a56db] border border-[#bfdbfe] font-semibold text-[12px] rounded-md transition-all flex items-center justify-center space-x-2 shadow-xs"
        >
          <FileCode className="h-3.5 w-3.5" />
          <span>Export GeoTIFF (.tif)</span>
        </a>

        <a
          href="/outputs/4_super_resolved_sub4m.png"
          download="GeoLens_SuperResolved_3_3m.png"
          className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[12px] rounded-md transition-all flex items-center justify-center space-x-2 border border-slate-300"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download 3.33m PNG</span>
        </a>

        <button
          onClick={onViewResults}
          className="w-full py-2 px-3 bg-[#1a56db] hover:bg-[#1546b3] text-white font-semibold text-[12px] rounded-md transition-all flex items-center justify-center space-x-2 shadow-xs mt-1"
        >
          <span>View All Generated Images</span>
        </button>
      </div>
    </aside>
  );
};
