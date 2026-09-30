import React from 'react';
import { Search, ChevronDown, CheckCircle2 } from 'lucide-react';
import { GeoSRLogo } from './Icons';

export const Header: React.FC = () => {
  return (
    <header className="relative w-full h-[88px] overflow-hidden select-none bg-[#030611] border-b border-sky-950/90 shadow-2xl z-30">
      {/* ── REALISTIC HALF-CURVED EARTH HORIZON PHOTO BACKGROUND ── */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Real photo PNG with curved Earth horizon, Rayleigh blue atmosphere, space & city lights */}
        <img
          src="/earth_horizon.png"
          alt="Earth Curved Horizon from Space"
          className="w-full h-full object-cover object-bottom opacity-90 contrast-110"
        />

        {/* Elegant cinematic darkening gradient to make every text label 100% crisp & legible */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#02050f]/85 via-[#030816]/55 to-[#02050f]/80" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#02040b]/60 via-transparent to-[#020612]/70" />
      </div>

      {/* ── NAVBAR CONTENT: SPACIOUS, ELEGANT & HIGH-CONTRAST TYPOGRAPHY ── */}
      <div className="relative z-10 w-full px-5 lg:px-8 h-full flex items-center justify-between gap-6">
        {/* Left: GeoLens Engine Brand Identity */}
        <div className="flex items-center space-x-3.5 flex-shrink-0">
          <div className="p-1.5 bg-[#0b1b36]/90 border border-sky-500/40 rounded-lg shadow-sm">
            <GeoSRLogo className="h-8 w-8" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[21px] font-bold text-white tracking-tight leading-tight drop-shadow-sm font-sans">
              GeoLens Engine
            </span>
            <span className="text-[10.5px] font-bold text-sky-400 tracking-widest uppercase drop-shadow-xs">
              GEOSPATIAL ANALYSIS PLATFORM
            </span>
          </div>
        </div>

        {/* Center: Spacious Navigation with Glowing Indicators */}
        <nav className="hidden md:flex items-center space-x-8 h-full">
          <a
            href="#workspace"
            className="text-white font-semibold text-[14px] relative py-2.5 transition-colors flex items-center"
          >
            <span>Pipeline Workspace</span>
            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#38bdf8] rounded-t-sm shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
          </a>

          <a
            href="#terminal-container"
            className="text-slate-300 hover:text-white font-medium text-[14px] transition-colors py-2.5"
          >
            Terminal Outputs
          </a>
        </nav>

        {/* Right: Search, Engine Health Badge, Tricolor Accent, User Profile */}
        <div className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
          {/* Coordinates Quick Search */}
          <div className="relative hidden xl:block w-64">
            <input
              type="text"
              placeholder="Search coordinates or AOI..."
              className="w-full bg-[#071324]/90 border border-slate-700/80 text-white placeholder-slate-400 text-[12.5px] font-medium rounded-md pl-3 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400 shadow-inner transition-all"
            />
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400 pointer-events-none" />
          </div>

          {/* Engine Status badge */}
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-[#051833]/90 border border-sky-400/40 rounded-md text-[11.5px] font-medium text-sky-200 shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>AuraClear: Ready</span>
          </div>

          {/* Saffron-White-Green Tricolor Accent */}
          <div className="flex items-center space-x-2.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/20 shadow-sm">
            {/* Vertical Indian Tricolor Accent Line */}
            <div className="flex flex-col w-[3.5px] h-8 rounded-full overflow-hidden shadow-[0_0_8px_rgba(255,153,51,0.8)]">
              <div className="bg-[#ff9933] flex-1 w-full" />
              <div className="bg-[#ffffff] flex-1 w-full" />
              <div className="bg-[#138808] flex-1 w-full" />
            </div>
            {/* Triad Words */}
            <div className="flex flex-col text-[9.5px] font-bold tracking-widest text-white leading-tight font-sans">
              <span className="text-white">PEOPLE</span>
              <span className="text-slate-200">PLANET</span>
              <span className="text-emerald-400">PROGRESS</span>
            </div>
          </div>

          {/* User Profile */}
          <div className="flex items-center space-x-1.5 pl-1 cursor-pointer group">
            <div className="w-8 h-8 rounded-full bg-[#1d4ed8] flex items-center justify-center text-white font-bold text-xs shadow-md ring-2 ring-sky-400/50">
              K
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-300 group-hover:text-white transition-colors" />
          </div>
        </div>
      </div>
    </header>
  );
};
