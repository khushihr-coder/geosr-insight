import React, { useState } from 'react';
import { Cloud, ArrowRight } from 'lucide-react';
import type { SatelliteScene } from '../data/mockData';

interface BottomSceneStripProps {
  scenes: SatelliteScene[];
  selectedSceneId: string;
  onSelectScene: (scene: SatelliteScene) => void;
}

// Visual scene graphic preview component for satellite thumbnails
const SceneThumbnail: React.FC<{ type: SatelliteScene['thumbnailType'] }> = ({ type }) => {
  switch (type) {
    case 'mountain':
      return (
        <svg viewBox="0 0 200 100" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="mtnGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e3a1e" />
              <stop offset="50%" stopColor="#3d2817" />
              <stop offset="100%" stopColor="#253529" />
            </linearGradient>
            <linearGradient id="snowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
          </defs>
          <rect width="200" height="100" fill="url(#mtnGrad)" />
          {/* Valley river */}
          <path d="M0,60 Q50,45 100,70 T200,50" fill="none" stroke="#38bdf8" strokeWidth="4" opacity="0.8" />
          {/* Mountain Ridges */}
          <polygon points="10,100 60,35 110,100" fill="#2d3725" opacity="0.9" />
          <polygon points="45,35 60,35 80,65 60,60 50,70" fill="url(#snowGrad)" opacity="0.95" />
          <polygon points="80,100 130,20 180,100" fill="#353b27" opacity="0.9" />
          <polygon points="115,20 130,20 150,55 130,50 120,60" fill="url(#snowGrad)" opacity="0.95" />
          <polygon points="140,100 175,40 200,90" fill="#293021" opacity="0.9" />
          <polygon points="165,40 175,40 190,65" fill="url(#snowGrad)" opacity="0.95" />
        </svg>
      );
    case 'agri':
      return (
        <svg viewBox="0 0 200 100" className="w-full h-full object-cover">
          <rect width="200" height="100" fill="#2b4c2b" />
          {/* Patchwork agriculture fields */}
          <rect x="10" y="10" width="40" height="35" fill="#3f6a33" opacity="0.85" />
          <rect x="55" y="8" width="50" height="40" fill="#557c3e" opacity="0.9" />
          <rect x="110" y="12" width="45" height="30" fill="#7a8d42" opacity="0.85" />
          <rect x="160" y="15" width="35" height="35" fill="#325826" opacity="0.9" />
          <rect x="15" y="50" width="60" height="42" fill="#586e37" opacity="0.9" />
          <rect x="80" y="55" width="40" height="38" fill="#446830" opacity="0.85" />
          <rect x="125" y="48" width="65" height="45" fill="#6b8e3d" opacity="0.9" />
          <path d="M0,45 Q70,55 140,42 T200,48" fill="none" stroke="#0284c7" strokeWidth="3" opacity="0.75" />
        </svg>
      );
    case 'terrain':
      return (
        <svg viewBox="0 0 200 100" className="w-full h-full object-cover">
          <rect width="200" height="100" fill="#4a5538" />
          {/* Terraced topography */}
          <path d="M-10,20 Q60,10 120,40 T220,25 L220,100 L-10,100 Z" fill="#3c462e" opacity="0.9" />
          <path d="M-10,50 Q80,35 150,70 T220,55 L220,100 L-10,100 Z" fill="#2e3823" opacity="0.95" />
          <path d="M-10,75 Q90,65 170,85 T220,78 L220,100 L-10,100 Z" fill="#1f2817" opacity="1" />
          {/* Subtle drainage streams */}
          <path d="M80,0 Q90,50 110,100" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6" />
        </svg>
      );
    case 'forest':
      return (
        <svg viewBox="0 0 200 100" className="w-full h-full object-cover">
          <rect width="200" height="100" fill="#1b3d22" />
          {/* Dense canopy textures */}
          <circle cx="30" cy="30" r="22" fill="#234e2c" opacity="0.9" />
          <circle cx="70" cy="25" r="26" fill="#1e4426" opacity="0.85" />
          <circle cx="120" cy="35" r="24" fill="#2b5c35" opacity="0.9" />
          <circle cx="170" cy="28" r="25" fill="#1d4225" opacity="0.95" />
          <circle cx="45" cy="70" r="28" fill="#16351d" opacity="0.9" />
          <circle cx="95" cy="75" r="30" fill="#25522f" opacity="0.9" />
          <circle cx="150" cy="68" r="27" fill="#1c3f24" opacity="0.9" />
          <circle cx="185" cy="80" r="20" fill="#2e6038" opacity="0.85" />
        </svg>
      );
    case 'sar':
      return (
        <svg viewBox="0 0 200 100" className="w-full h-full object-cover">
          <rect width="200" height="100" fill="#27272a" />
          {/* SAR Speckle & backscatter pattern */}
          <path d="M10,20 Q60,40 100,15 T190,30" fill="none" stroke="#71717a" strokeWidth="4" opacity="0.8" />
          <path d="M0,50 Q70,30 130,65 T200,45" fill="none" stroke="#a1a1aa" strokeWidth="3" opacity="0.75" />
          <path d="M20,80 Q80,95 150,75 T200,90" fill="none" stroke="#52525b" strokeWidth="5" opacity="0.9" />
          <rect x="0" y="0" width="200" height="100" fill="none" stroke="#e4e4e7" strokeWidth="0.8" strokeDasharray="2, 6" opacity="0.4" />
        </svg>
      );
  }
};

export const BottomSceneStrip: React.FC<BottomSceneStripProps> = ({
  scenes,
  selectedSceneId,
  onSelectScene,
}) => {
  const [activeTab, setActiveTab] = useState<'Recent Scenes' | 'Search Results' | 'Analysis Results'>(
    'Recent Scenes'
  );

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-lg shadow-sm p-3.5 mt-3 select-none">
      {/* Header bar with tabs & view all */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
        <div className="flex space-x-6">
          {(['Recent Scenes', 'Search Results', 'Analysis Results'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-[13px] font-medium transition-colors relative pb-2 ${
                  isActive
                    ? 'text-[#1e60d5] font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#1e60d5] rounded-t-sm" />
                )}
              </button>
            );
          })}
        </div>

        <button className="flex items-center space-x-1 text-[12px] font-semibold text-[#1e60d5] hover:text-blue-700 transition-colors">
          <span>View All</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Horizontal Image Cards Container */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 overflow-x-auto pb-1">
        {scenes.map((scene) => {
          const isSelected = scene.id === selectedSceneId;
          return (
            <div
              key={scene.id}
              onClick={() => onSelectScene(scene)}
              className={`flex flex-col bg-white rounded-md border transition-all cursor-pointer overflow-hidden group ${
                isSelected
                  ? 'border-[#2563eb] ring-2 ring-blue-500/30 shadow-md scale-[1.01]'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              {/* Scene Image Thumbnail */}
              <div className="h-20 sm:h-22 w-full bg-slate-900 overflow-hidden relative">
                <SceneThumbnail type={scene.thumbnailType} />
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-[#2563eb] text-white text-[9.5px] font-bold rounded uppercase tracking-wider shadow">
                    Active
                  </div>
                )}
              </div>

              {/* Card Meta Content */}
              <div className="p-2.5 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="text-[12px] font-semibold text-slate-800 tracking-tight leading-tight group-hover:text-[#1e60d5] transition-colors truncate">
                    {scene.name}
                  </h4>
                  <span className="text-[11px] text-slate-500 block mt-0.5 font-normal">
                    {scene.date}
                  </span>
                </div>

                <div className="flex items-center space-x-1 text-[11px] text-slate-600 mt-2 font-medium">
                  <Cloud className="h-3.5 w-3.5 text-slate-400" />
                  <span>{scene.cloudCover}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
