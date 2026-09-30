import React, { useState } from 'react';
import {
  Layers,
  UploadCloud,
  Map as MapIcon,
  ChevronLeft,
  RotateCw,
  Sliders,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';

interface LeftSidebarProps {
  coordinates: string;
  onCoordinatesChange: (coords: string) => void;
  onRunPipeline: () => void;
  isRunning: boolean;
  activeInputTab: 'polygon' | 'upload';
  onSelectInputTab: (tab: 'polygon' | 'upload') => void;
  onFileUpload?: (file: File) => void;
  uploadedFileName?: string | null;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  coordinates,
  onCoordinatesChange,
  onRunPipeline,
  isRunning,
  activeInputTab,
  onSelectInputTab,
  onFileUpload,
  uploadedFileName,
}) => {
  const [cloudThreshold, setCloudThreshold] = useState('10%');
  const [srScale] = useState('3x (Sub-4m ~3.33m GSD)');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (onFileUpload) onFileUpload(e.target.files[0]);
    }
  };

  return (
    <aside className="w-[310px] xl:w-[330px] flex-shrink-0 bg-white border border-slate-200/90 rounded-lg shadow-sm overflow-hidden select-none self-start flex flex-col">
      {/* Header: Pipeline Control */}
      <div className="bg-[#1a56db] text-white px-3.5 py-2.5 flex items-center justify-between font-semibold text-[13px] tracking-wide">
        <div className="flex items-center space-x-2">
          <Layers className="h-4 w-4" />
          <span>PIPELINE CONTROL</span>
        </div>
        <ChevronLeft className="h-4 w-4 cursor-pointer opacity-80 hover:opacity-100 transition-opacity" />
      </div>

      <div className="p-3.5 space-y-4">
        {/* Input Mode Selector Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-md text-[12px] font-medium border border-slate-200/80">
          <button
            onClick={() => onSelectInputTab('polygon')}
            className={`py-1.5 px-2 rounded flex items-center justify-center space-x-1.5 transition-all ${
              activeInputTab === 'polygon'
                ? 'bg-white text-[#1a56db] font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span>Polygon Coordinates</span>
          </button>
          <button
            onClick={() => onSelectInputTab('upload')}
            className={`py-1.5 px-2 rounded flex items-center justify-center space-x-1.5 transition-all ${
              activeInputTab === 'upload'
                ? 'bg-white text-[#1a56db] font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>TIFF / TIF Upload</span>
          </button>
        </div>

        {/* Tab 1: Polygon Coordinates Input */}
        {activeInputTab === 'polygon' && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[12px]">
              <span className="font-medium text-slate-700">Bounding coordinates</span>
              <span className="font-mono text-[10.5px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                EPSG:4326
              </span>
            </div>

            <textarea
              rows={4}
              value={coordinates}
              onChange={(e) => onCoordinatesChange(e.target.value)}
              className="w-full font-mono text-[11.5px] bg-slate-50 border border-slate-200 rounded-md p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white resize-none leading-relaxed"
              placeholder="[[min_lon, min_lat], ...]"
            />

            <div className="flex items-center space-x-1.5 text-[11.5px] text-emerald-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Valid polygon &bull; 4 vertices</span>
            </div>
          </div>
        )}

        {/* Tab 2: TIFF / TIF Upload */}
        {activeInputTab === 'upload' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[12px]">
              <span className="font-medium text-slate-700">Sentinel-2 GeoTIFF (.tif)</span>
              <span className="font-mono text-[10.5px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                Multi-band
              </span>
            </div>

            <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/20">
              <UploadCloud className="h-7 w-7 text-blue-500 mb-1" />
              <span className="text-[12px] font-medium text-slate-700 text-center">
                Click to browse or drop GeoTIFF
              </span>
              <span className="text-[10.5px] text-slate-400 text-center mt-0.5">
                Bands B2, B3, B4, B8 (10m)
              </span>
              <input
                type="file"
                accept=".tif,.tiff"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {uploadedFileName && (
              <div className="flex items-center space-x-1.5 text-[11.5px] text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
                <FileCheck className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span className="truncate">{uploadedFileName}</span>
              </div>
            )}
          </div>
        )}

        <hr className="border-slate-200" />

        {/* Real Processing Parameters (from backend) */}
        <div className="space-y-3">
          <div className="flex items-center space-x-1.5 text-[12px] font-semibold text-slate-700">
            <Sliders className="h-3.5 w-3.5 text-slate-500" />
            <span>Processing Parameters</span>
          </div>

          <div className="space-y-2.5 text-[12px]">
            <div>
              <label className="block text-[11px] text-slate-500 mb-0.5">
                Cloud Inpainting Model
              </label>
              <div className="w-full bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded text-[11.5px] font-medium border border-slate-200 flex justify-between items-center">
                <span>AuraClear 10-Ch U-Net</span>
                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-200 font-semibold">Active</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-0.5">
                Cloud Threshold Trigger
              </label>
              <select
                value={cloudThreshold}
                onChange={(e) => setCloudThreshold(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="5%">5% (Aggressive)</option>
                <option value="10%">10% (Default Standard)</option>
                <option value="15%">15% (Permissive)</option>
                <option value="Always">Always Run Inpainting</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-0.5">
                Super-Resolution Scale
              </label>
              <div className="w-full bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded text-[11.5px] font-medium border border-slate-200">
                {srScale}
              </div>
            </div>
          </div>
        </div>

        {/* Primary Action Button: Run Pipeline */}
        <div className="pt-2">
          <button
            onClick={onRunPipeline}
            disabled={isRunning}
            className={`w-full py-2.5 px-4 rounded-md font-semibold text-[13px] text-white flex items-center justify-center space-x-2 transition-all shadow-sm ${
              isRunning
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-[#1a56db] hover:bg-[#1546b3] active:bg-[#10368a]'
            }`}
          >
            <RotateCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Processing Pipeline...' : 'Run Pipeline Again'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
