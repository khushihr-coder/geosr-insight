import React from 'react';
import { X, CheckCircle2, Download, BarChart2, Zap } from 'lucide-react';
import type { SatelliteScene } from '../data/mockData';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  scene: SatelliteScene;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  isOpen,
  onClose,
  scene,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#0b1626] text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <Zap className="h-5 w-5 text-amber-400" />
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-white">
                Geospatial Super-Resolution Analysis Report
              </h3>
              <p className="text-[11px] text-slate-300">
                AI Deep Learning Inference &bull; GeoSR-Insight Model v2.4
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

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-slate-700">
          {/* Status summary banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 flex items-start space-x-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[13px] font-semibold text-emerald-900">
                Inference Complete &bull; 4&times; Spatial Resolution Enhancement
              </h4>
              <p className="text-[12px] text-emerald-700 mt-0.5">
                Target scene <span className="font-semibold">{scene.name}</span> processed successfully. Ground Sampling Distance (GSD) enhanced from 30.0m to 7.5m per pixel.
              </p>
            </div>
          </div>

          {/* Metric cards grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-center">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Peak SNR (PSNR)
              </span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">34.82 dB</span>
              <span className="text-[10px] text-emerald-600 font-medium">+5.4 dB over bicubic</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-center">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Structural Sim. (SSIM)
              </span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">0.946</span>
              <span className="text-[10px] text-emerald-600 font-medium">High fidelity retention</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-center">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Spectral Angle (SAM)
              </span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">2.18&deg;</span>
              <span className="text-[10px] text-emerald-600 font-medium">Minimal distortion</span>
            </div>
          </div>

          {/* Detailed scene parameter table */}
          <div className="border border-slate-200 rounded-md overflow-hidden text-[12px]">
            <div className="bg-slate-100/80 px-3.5 py-2 font-semibold text-slate-700 flex items-center space-x-2 border-b border-slate-200">
              <BarChart2 className="h-4 w-4 text-slate-500" />
              <span>Pipeline Acquisition Parameters</span>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="px-3.5 py-2 flex justify-between bg-white">
                <span className="text-slate-500">Target AOI Bounding Box</span>
                <span className="font-mono text-slate-800">{scene.coordinates}</span>
              </div>
              <div className="px-3.5 py-2 flex justify-between bg-slate-50/50">
                <span className="text-slate-500">Total Analyzed Area</span>
                <span className="font-semibold text-slate-800">{scene.area}</span>
              </div>
              <div className="px-3.5 py-2 flex justify-between bg-white">
                <span className="text-slate-500">Acquisition Timestamp</span>
                <span className="text-slate-800">{scene.date}</span>
              </div>
              <div className="px-3.5 py-2 flex justify-between bg-slate-50/50">
                <span className="text-slate-500">Residual Cloud Obstruction</span>
                <span className="text-slate-800 font-medium">{scene.cloudCover}%</span>
              </div>
              <div className="px-3.5 py-2 flex justify-between bg-white">
                <span className="text-slate-500">Pre-processing Calibration</span>
                <span className="text-slate-800">{scene.processingLevel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3.5 flex justify-end space-x-2.5 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-[13px] font-medium rounded-md transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => alert(`Exporting Super-Resolution GeoTIFF package for ${scene.name}...`)}
            className="px-4 py-2 bg-[#0f396b] hover:bg-[#0c2f59] text-white text-[13px] font-medium rounded-md shadow-sm transition-colors flex items-center space-x-1.5"
          >
            <Download className="h-4 w-4" />
            <span>Export GeoTIFF (.tif)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
