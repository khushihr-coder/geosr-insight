import React from 'react';
import { Search, ChevronDown, CheckCircle2 } from 'lucide-react';
import { GeoSRLogo } from './Icons';

export const HeaderBanner: React.FC = () => {
  return (
    <div className="relative w-full overflow-hidden select-none bg-[#040914] shadow-md border-b border-slate-800">
      {/* ── BACKGROUND: REALISTIC HALF-EARTH ORBITAL VIEW ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Deep space background with subtle stars */}
        <div className="absolute inset-0 bg-[#040914] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />

        {/* Half Earth Globe Curvature rising from the bottom */}
        <div className="absolute -bottom-[260px] sm:-bottom-[300px] md:-bottom-[340px] left-1/2 -translate-x-1/2 w-[1100px] sm:w-[1500px] md:w-[1900px] h-[550px] sm:h-[650px] md:h-[750px] rounded-[50%] overflow-hidden pointer-events-none">
          {/* Earth Body Gradient: Deep ocean blue, continents & atmospheric haze */}
          <div className="w-full h-full bg-gradient-to-t from-[#061836] via-[#0b2854] to-[#0d3b75] relative">
            {/* Atmospheric glow on Earth limb */}
            <div className="absolute inset-0 shadow-[inset_0_40px_80px_rgba(56,189,248,0.7),inset_0_15px_30px_rgba(255,255,255,0.8)]" />

            {/* Simulated Continent & Cloud Silhouettes on the curved Earth limb */}
            <svg viewBox="0 0 1200 400" className="w-full h-full opacity-60 mix-blend-screen">
              <path
                d="M 50,200 Q 200,120 400,160 T 750,110 T 1150,180"
                fill="none"
                stroke="#15803d"
                strokeWidth="45"
                opacity="0.35"
                filter="blur(15px)"
              />
              <path
                d="M 120,180 Q 250,90 500,130 T 900,95 T 1100,150"
                fill="none"
                stroke="#047857"
                strokeWidth="35"
                opacity="0.3"
                filter="blur(12px)"
              />
              {/* Swirling white cloud ribbons */}
              <path
                d="M 0,160 Q 250,70 550,120 T 1000,80 T 1200,140"
                fill="none"
                stroke="#ffffff"
                strokeWidth="24"
                opacity="0.55"
                filter="blur(8px)"
              />
              <path
                d="M 100,130 Q 350,60 650,90 T 1150,110"
                fill="none"
                stroke="#ffffff"
                strokeWidth="16"
                opacity="0.45"
                filter="blur(6px)"
              />
            </svg>
          </div>
        </div>

        {/* Glowing atmospheric limb halo along the horizon edge */}
        <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-gradient-to-t from-sky-500/20 via-blue-500/10 to-transparent pointer-events-none" />

        {/* Soft dark vignette over the top to keep navbar text razor sharp */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#040914]/85 via-[#040914]/40 to-transparent pointer-events-none" />
      </div>

      {/* ── TOP NAVBAR: FLOATING ON TOP OF THE HALF-EARTH BACKGROUND ── */}
      <div className="relative z-10 w-full px-4 lg:px-6 h-[64px] flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950/40 backdrop-blur-md">
        {/* Left: GeoLens Engine Brand Identity */}
        <div className="flex items-center space-x-3 flex-shrink-0">
          <GeoSRLogo className="h-8 w-8 shadow-sm" />
          <div className="flex flex-col justify-center">
            <span className="text-[18px] sm:text-[19px] font-semibold text-white tracking-tight leading-tight drop-shadow-sm">
              GeoLens Engine
            </span>
            <span className="text-[10px] sm:text-[10.5px] font-medium text-slate-300 tracking-wider uppercase drop-shadow-xs">
              GEOSPATIAL ANALYSIS PLATFORM
            </span>
          </div>
        </div>

        {/* Center: Simplified Navigation */}
        <nav className="hidden md:flex items-center space-x-6 h-full text-[13px]">
          <a
            href="#workspace"
            className="text-white font-semibold relative py-1.5 border-b-2 border-[#38bdf8]"
          >
            Pipeline Workspace
          </a>
          <a
            href="#terminal-container"
            className="text-slate-300 hover:text-white transition-colors"
          >
            Terminal & Outputs
          </a>
        </nav>

        {/* Right: Search, Engine Health Status, User Profile */}
        <div className="flex items-center space-x-3.5 flex-shrink-0">
          {/* Coordinates Quick Search */}
          <div className="relative hidden xl:block w-64">
            <input
              type="text"
              placeholder="Search coordinates or AOI..."
              className="w-full bg-[#111c2e]/80 border border-slate-700/80 text-slate-200 placeholder-slate-400 text-[12px] rounded-md pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 backdrop-blur-xs"
            />
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Engine Status badge */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-[#091b33]/80 border border-sky-500/30 rounded-md text-[11.5px] text-sky-200 backdrop-blur-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>AuraClear Engine: Ready</span>
          </div>

          {/* User Profile */}
          <div className="flex items-center space-x-1.5 pl-1 cursor-pointer group">
            <div className="w-7 h-7 rounded-full bg-[#2563eb] flex items-center justify-center text-white font-medium text-xs shadow-sm ring-2 ring-sky-400/30">
              K
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400 group-hover:text-slate-200 transition-colors" />
          </div>
        </div>
      </div>

      {/* ── BANNER CONTENT AREA: EXPLORE. ANALYZE. UNDERSTAND. ── */}
      <div className="relative z-10 max-w-[1740px] mx-auto px-4 lg:px-6 py-4 sm:py-5 flex items-center justify-between gap-4">
        {/* Left Side: Editorial Serif Title & Subtitle */}
        <div className="flex flex-col justify-center max-w-2xl">
          <h1 className="text-xl sm:text-2xl md:text-[28px] font-normal tracking-tight text-white font-serif drop-shadow-md leading-tight">
            Explore. Analyze. Understand.
          </h1>
          <p className="text-[12px] sm:text-[13px] text-slate-200 mt-1 font-light tracking-wide drop-shadow">
            High-Resolution Geospatial Data for a Sustainable Future
          </p>
        </div>

        {/* Right Side: Tricolor Pillar & People Planet Progress */}
        <div className="flex items-center space-x-3 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded border border-white/10 shadow-sm flex-shrink-0">
          {/* Vertical Indian Tricolor Accent */}
          <div className="flex flex-col w-[3.5px] h-10 rounded-full overflow-hidden shadow-[0_0_8px_rgba(255,153,51,0.6)]">
            <div className="bg-[#ff9933] flex-1 w-full" />
            <div className="bg-[#ffffff] flex-1 w-full" />
            <div className="bg-[#138808] flex-1 w-full" />
          </div>

          {/* Triad Words */}
          <div className="flex flex-col text-[11px] font-bold tracking-widest text-white leading-tight font-sans">
            <span className="text-white">PEOPLE</span>
            <span className="text-slate-200">PLANET</span>
            <span className="text-emerald-400">PROGRESS</span>
          </div>
        </div>
      </div>
    </div>
  );
};
