import React from 'react';

export const HeroBanner: React.FC = () => {
  return (
    <div className="relative w-full h-[120px] md:h-[135px] overflow-hidden select-none bg-[#0a1829] shadow-inner">
      {/* Background Satellite Mountain Image */}
      <img
        src="/hero_banner.jpg"
        alt="Earth Observation Satellite Terrain"
        className="w-full h-full object-cover object-center brightness-95 contrast-105"
        onError={(e) => {
          // Graceful fallback gradient if image fails to load
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />

      {/* Atmospheric Overlays & Vignette */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#071324]/90 via-[#071324]/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628]/60 via-transparent to-black/30" />

      {/* Banner Content Container */}
      <div className="absolute inset-0 max-w-[1700px] mx-auto px-6 lg:px-10 flex items-center justify-between">
        {/* Left Side: Editorial Typography */}
        <div className="flex flex-col justify-center max-w-2xl">
          <h1 className="text-2xl sm:text-3xl md:text-[34px] font-normal tracking-tight text-white font-serif drop-shadow-md leading-tight">
            Explore. Analyze. Understand.
          </h1>
          <p className="text-[13px] sm:text-[14px] text-slate-200 mt-1 font-light tracking-wide drop-shadow">
            High-Resolution Geospatial Data for a Sustainable Future
          </p>
        </div>

        {/* Right Side: Tricolor Pillar & National Mission Motto */}
        <div className="hidden sm:flex items-center space-x-3.5 bg-black/25 backdrop-blur-[2px] px-4 py-2 rounded border border-white/10 shadow-sm">
          {/* Vertical Indian Tricolor Accent */}
          <div className="flex flex-col w-[3.5px] h-12 rounded-full overflow-hidden shadow-[0_0_8px_rgba(255,153,51,0.5)]">
            <div className="bg-[#ff9933] flex-1 w-full" />
            <div className="bg-[#ffffff] flex-1 w-full" />
            <div className="bg-[#138808] flex-1 w-full" />
          </div>

          {/* Triad Words */}
          <div className="flex flex-col text-[12px] font-bold tracking-widest text-white leading-tight font-sans">
            <span className="text-white hover:text-orange-200 transition-colors">PEOPLE</span>
            <span className="text-slate-100 hover:text-white transition-colors">PLANET</span>
            <span className="text-emerald-300 hover:text-emerald-200 transition-colors">PROGRESS</span>
          </div>
        </div>
      </div>
    </div>
  );
};
