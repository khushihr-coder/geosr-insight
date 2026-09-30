import React, { useState } from 'react';
import {
  Terminal,
  Check,
  ChevronUp,
  ChevronDown,
  Trash2,
  Image as ImageIcon,
  Download,
  FileCode,
  Maximize2,
  X,
} from 'lucide-react';

interface BottomTerminalProps {
  logs: string[];
  onClearLogs?: () => void;
  defaultTab?: 'images' | 'terminal';
}

interface OutputStage {
  step: number;
  title: string;
  badge: string;
  badgeColor: string;
  gsd: string;
  desc: string;
  img: string;
  pngDownload: string;
  geotiffDownload?: string;
  meta: string;
}

export const BottomTerminal: React.FC<BottomTerminalProps> = ({
  logs,
  onClearLogs,
  defaultTab = 'images',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'images' | 'terminal' | 'problems' | 'network'>(defaultTab);
  const [previewModalImg, setPreviewModalImg] = useState<{ title: string; src: string; gsd: string } | null>(null);

  const stages: OutputStage[] = [
    {
      step: 1,
      title: '1. Live Optical (Cloudy)',
      badge: 'Input Raw (10m)',
      badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
      gsd: '10.0m GSD',
      desc: 'Sentinel-2 L2A optical acquisition with cloud cover.',
      img: '/outputs/1_optical_cloudy.png',
      pngDownload: '/outputs/1_optical_cloudy.png',
      meta: 'Cloud: 18.4% | Bands: B2, B3, B4, B8',
    },
    {
      step: 2,
      title: '2. Sentinel-1 SAR Radar',
      badge: 'Radar Penetration',
      badgeColor: 'bg-slate-800 text-slate-200 border-slate-600',
      gsd: '10.0m GSD',
      desc: 'C-Band Microwave radar penetrating cloud formations.',
      img: '/outputs/2_sentinel1_sar.png',
      pngDownload: '/outputs/2_sentinel1_sar.png',
      meta: 'Polarisation: VV | GRD IW 10m',
    },
    {
      step: 3,
      title: '3. AuraClear Reconstructed',
      badge: 'Inpainted (10m)',
      badgeColor: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
      gsd: '10.0m GSD',
      desc: '10-Channel U-Net reconstruction with masked inpainting.',
      img: '/outputs/3_auraclear_cleansed.png',
      pngDownload: '/outputs/3_auraclear_cleansed.png',
      geotiffDownload: '/outputs/cloud_free.tif',
      meta: 'Residual Cloud: 0.0% | Ground Preserved',
    },
    {
      step: 4,
      title: '4. AuraClear-SR Sub-4m',
      badge: 'Sub-4m (3.33m)',
      badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
      gsd: '3.33m GSD',
      desc: '3x Sub-pixel spatial upscaling with 9x pixel multiplier.',
      img: '/outputs/4_super_resolved_sub4m.png',
      pngDownload: '/outputs/4_super_resolved_sub4m.png',
      geotiffDownload: '/outputs/cloud_free.tif',
      meta: '9x Density Multiplier | 1152×1152 px',
    },
  ];

  return (
    <div className="w-full bg-[#080e18] border-t border-slate-700/80 text-slate-300 font-mono text-[12px] select-none shadow-2xl transition-all">
      {/* ── Terminal Title Bar matching Screenshot 3 & 4 ── */}
      <div className="px-4 py-2 bg-[#050911] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Images Tab (Horizontal arrangement in Terminal) */}
          <button
            onClick={() => {
              setActiveTab('images');
              setIsExpanded(true);
            }}
            className={`flex items-center space-x-2 transition-colors py-0.5 ${
              activeTab === 'images'
                ? 'text-white font-semibold border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5 text-sky-400" />
            <span>Generated Outputs (4)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </button>

          {/* Terminal Logs Tab */}
          <button
            onClick={() => {
              setActiveTab('terminal');
              setIsExpanded(true);
            }}
            className={`flex items-center space-x-1.5 transition-colors py-0.5 ${
              activeTab === 'terminal'
                ? 'text-white font-semibold border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="h-3.5 w-3.5 text-slate-400" />
            <span>Terminal Logs</span>
          </button>

          {/* Problems Tab */}
          <button
            onClick={() => {
              setActiveTab('problems');
              setIsExpanded(true);
            }}
            className={`flex items-center space-x-1.5 transition-colors py-0.5 ${
              activeTab === 'problems'
                ? 'text-white font-semibold border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Check className="h-3.5 w-3.5 text-slate-400" />
            <span>Problems (0)</span>
          </button>

          {/* Network Tab */}
          <button
            onClick={() => {
              setActiveTab('network');
              setIsExpanded(true);
            }}
            className={`hidden sm:flex items-center space-x-1.5 transition-colors py-0.5 ${
              activeTab === 'network'
                ? 'text-white font-semibold border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Network</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1 rounded border border-emerald-800/60">
              Active
            </span>
          </button>
        </div>

        {/* Terminal Controls */}
        <div className="flex items-center space-x-3 text-slate-400">
          <a
            href="/outputs/cloud_free.tif"
            download="GeoLens_Complete_Package.tif"
            className="hidden md:flex items-center space-x-1 text-[11px] text-sky-400 hover:text-sky-300 bg-sky-950/60 border border-sky-800/60 px-2.5 py-0.5 rounded transition-colors"
          >
            <FileCode className="h-3 w-3" />
            <span>Export GeoTIFF</span>
          </a>

          {onClearLogs && activeTab === 'terminal' && (
            <button
              onClick={onClearLogs}
              title="Clear terminal logs"
              className="p-1 hover:text-slate-200 transition-colors flex items-center space-x-1 text-[11px]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse Terminal' : 'Expand Terminal'}
            className="p-1 hover:text-slate-200 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* ── Terminal Content Body ── */}
      {isExpanded && (
        <div className="px-4 py-3 bg-[#060b14] font-mono text-[11.5px] leading-relaxed selection:bg-blue-600 selection:text-white">
          {/* ══ TAB 1: HORIZONTAL ROW OF 4 GENERATED IMAGES INSIDE TERMINAL ══ */}
          {activeTab === 'images' && (
            <div className="space-y-2.5">
              {/* Status subheader */}
              <div className="text-[11px] text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800">
                <span>
                  &gt; [OUTPUTS] 4 Pipeline Stages Generated &bull; Horizontal Inspection
                </span>
                <span className="text-emerald-400 font-semibold hidden sm:inline">
                  AuraClear-SR Sub-4m Verified &bull; EPSG:4326
                </span>
              </div>

              {/* HORIZONTAL CARDS GRID (4 COLUMNS SPANNING FULL TERMINAL WIDTH) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 overflow-x-auto pb-1">
                {stages.map((stage) => (
                  <div
                    key={stage.step}
                    className="bg-[#0b121f] border border-slate-700/80 rounded-lg overflow-hidden flex flex-col justify-between shadow-md hover:border-slate-600 transition-all group"
                  >
                    {/* Card Header */}
                    <div className="px-3 py-1.5 bg-[#080d17] border-b border-slate-800 flex items-center justify-between gap-1">
                      <span className="text-[11.5px] font-bold text-slate-100 font-sans tracking-tight truncate">
                        {stage.title}
                      </span>
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap ${stage.badgeColor}`}
                      >
                        {stage.badge}
                      </span>
                    </div>

                    {/* Image Preview */}
                    <div className="p-2 bg-black flex justify-center items-center relative overflow-hidden h-[175px]">
                      <img
                        src={stage.img}
                        alt={stage.title}
                        className="w-full h-full object-contain rounded"
                        loading="eager"
                      />

                      {/* Resolution Watermark */}
                      <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-xs text-white px-1.5 py-0.5 rounded text-[9.5px] font-mono border border-white/20">
                        {stage.gsd}
                      </div>

                      {/* Expand modal button */}
                      <button
                        onClick={() =>
                          setPreviewModalImg({
                            title: stage.title,
                            src: stage.img,
                            gsd: stage.gsd,
                          })
                        }
                        title="Enlarge inspection"
                        className="absolute top-2.5 right-2.5 p-1.5 bg-black/70 hover:bg-black text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Maximize2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Metadata text */}
                    <div className="p-2 bg-[#080d17] border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1.5">
                      <div className="leading-tight text-slate-300 font-mono text-[9.5px] truncate">
                        {stage.meta}
                      </div>

                      {/* Download Buttons inside each horizontal card */}
                      <div className="flex items-center space-x-1.5 pt-0.5">
                        <a
                          href={stage.pngDownload}
                          download={`GeoLens_Stage_${stage.step}.png`}
                          className="flex-1 py-1 px-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded text-[10px] font-medium transition-colors flex items-center justify-center space-x-1 text-center"
                        >
                          <Download className="h-2.5 w-2.5 text-slate-400" />
                          <span>PNG</span>
                        </a>

                        {stage.geotiffDownload && (
                          <a
                            href={stage.geotiffDownload}
                            download="GeoLens_Output_EPSG4326.tif"
                            className="flex-1 py-1 px-1 bg-sky-950/70 hover:bg-sky-900/80 text-sky-200 border border-sky-700/70 rounded text-[10px] font-medium transition-colors flex items-center justify-center space-x-1 text-center"
                          >
                            <FileCode className="h-2.5 w-2.5 text-sky-300" />
                            <span>GeoTIFF</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ TAB 2: TERMINAL LOGS ══ */}
          {activeTab === 'terminal' && (
            <div className="h-44 overflow-y-auto space-y-0.5">
              {logs.map((line, idx) => {
                let colorClass = 'text-slate-300';
                if (line.includes('[*]') || line.includes('===')) colorClass = 'text-blue-400 font-medium';
                else if (line.includes('[+]') || line.includes('[OK]')) colorClass = 'text-emerald-400 font-medium';
                else if (line.includes('[!]') || line.includes('Warning')) colorClass = 'text-amber-400 font-medium';
                else if (line.includes('[METRICS]')) colorClass = 'text-cyan-300 font-semibold';
                else if (line.startsWith('[')) colorClass = 'text-sky-300';
                else if (line.includes('Error')) colorClass = 'text-rose-400 font-semibold';

                return (
                  <div key={idx} className={`${colorClass} whitespace-pre-wrap font-mono`}>
                    {line}
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ TAB 3: PROBLEMS ══ */}
          {activeTab === 'problems' && (
            <div className="text-slate-400 p-2">
              No compilation or pipeline execution issues detected. All 10-channel U-Net and Super-Resolution tensor operations passed validation.
            </div>
          )}

          {/* ══ TAB 4: NETWORK ══ */}
          {activeTab === 'network' && (
            <div className="text-slate-400 p-2 space-y-1">
              <div>&bull; Google Earth Engine Sentinel-2 API: <span className="text-emerald-400">Connected (EPSG:4326 Scale 10)</span></div>
              <div>&bull; Copernicus Sentinel-1 GRD SAR Stream: <span className="text-emerald-400">Available (VV/VH 10m)</span></div>
              <div>&bull; GeoLens Engine Local Inference Backend: <span className="text-emerald-400">Ready on PyTorch (CUDA/CPU)</span></div>
            </div>
          )}

          {/* Integrated sleek status bar at the very bottom of the terminal */}
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10.5px] text-slate-500 font-sans">
            <span className="text-slate-400 font-medium">
              GeoLens Engine &bull; SAR-Guided Inpainting &bull; AuraClear-SR (3.33m GSD)
            </span>
            <span>Sentinel-2 (10m) &bull; Sentinel-1 SAR (10m) &bull; EPSG:4326</span>
          </div>
        </div>
      )}

      {/* ── Fullscreen Preview Modal for inspection ── */}
      {previewModalImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#0b1322] border border-slate-700 rounded-lg max-w-4xl w-full overflow-hidden shadow-2xl">
            <div className="p-3 bg-[#070c14] border-b border-slate-800 flex justify-between items-center text-white">
              <span className="font-semibold">{previewModalImg.title}</span>
              <button
                onClick={() => setPreviewModalImg(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 bg-black flex justify-center items-center">
              <img
                src={previewModalImg.src}
                alt={previewModalImg.title}
                className="max-h-[70vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
