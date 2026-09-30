import React from 'react';

// Modern GeoSR-Insight Geospatial Radar & Satellite Aperture Logo
export const GeoSRLogo: React.FC<{ className?: string }> = ({ className = "h-8 w-auto" }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#1e3a8a" />
    {/* Coordinate grid lines */}
    <path d="M8 20 H32 M20 8 V32" stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.6" />
    {/* Concentric radar range rings */}
    <circle cx="20" cy="20" r="14" stroke="#60a5fa" strokeWidth="1.5" opacity="0.4" />
    <circle cx="20" cy="20" r="8" stroke="#93c5fd" strokeWidth="1.8" opacity="0.8" />
    {/* Super-resolution aperture target marker */}
    <rect x="16" y="16" width="8" height="8" rx="1.5" fill="#3b82f6" />
    <circle cx="20" cy="20" r="2" fill="#ffffff" />
    {/* Dynamic scan line */}
    <path d="M20 20 L30 10" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
