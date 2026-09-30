import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#0b1626] text-slate-400 border-t border-slate-800 text-[12px] py-4 px-6 select-none mt-10">
      <div className="max-w-[1740px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Clean Brand */}
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-200">GeoLens Engine</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">Geospatial Analysis Platform</span>
        </div>

        {/* Right: Technical Info */}
        <div className="flex items-center space-x-4 text-slate-400 text-[11.5px]">
          <span>Sentinel-2 (10m) &bull; Sentinel-1 SAR (10m) &bull; AuraClear-SR (3.33m GSD)</span>
          <span className="text-slate-700">&bull;</span>
          <span>EPSG:4326</span>
        </div>
      </div>
    </footer>
  );
};
