import React, { useState } from 'react';
import { Calendar, ChevronDown, Search } from 'lucide-react';
import { DATASET_OPTIONS, CLOUD_COVER_OPTIONS, PROCESSING_LEVEL_OPTIONS } from '../data/mockData';

interface FilterBarProps {
  onSearch?: (filters: FilterState) => void;
  selectedDataset?: string;
  onDatasetChange?: (dataset: string) => void;
}

export interface FilterState {
  dataset: string;
  dateRange: string;
  cloudCover: string;
  processingLevel: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  onSearch,
  selectedDataset = 'Landsat 9 OLI',
  onDatasetChange,
}) => {
  const [dataset, setDataset] = useState(selectedDataset);
  const [dateRange, setDateRange] = useState('01 Jan 2024 – 30 Sep 2024');
  const [cloudCover, setCloudCover] = useState('≤ 10%');
  const [processingLevel, setProcessingLevel] = useState('Level-2 (Surface Reflectance)');

  const handleDatasetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDataset(val);
    if (onDatasetChange) onDatasetChange(val);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({
        dataset,
        dateRange,
        cloudCover,
        processingLevel,
      });
    }
  };

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-lg shadow-sm px-4 py-3 mb-3">
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap lg:flex-nowrap items-end gap-3.5">
        {/* Dataset */}
        <div className="flex-1 min-w-[170px]">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Dataset
          </label>
          <div className="relative">
            <select
              value={dataset}
              onChange={handleDatasetSelect}
              className="w-full appearance-none bg-slate-50/70 border border-slate-200 text-slate-800 text-[13px] font-medium rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              {DATASET_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Date Range */}
        <div className="flex-1 min-w-[210px]">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Date Range
          </label>
          <div className="relative flex items-center">
            <div className="absolute left-2.5 text-slate-400 pointer-events-none">
              <Calendar className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full bg-slate-50/70 border border-slate-200 text-slate-800 text-[13px] font-medium rounded-md pl-9 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <div className="absolute right-2.5 text-slate-400 pointer-events-none">
              <Calendar className="h-3.5 w-3.5 opacity-60" />
            </div>
          </div>
        </div>

        {/* Cloud Cover */}
        <div className="w-[125px]">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Cloud Cover
          </label>
          <div className="relative">
            <select
              value={cloudCover}
              onChange={(e) => setCloudCover(e.target.value)}
              className="w-full appearance-none bg-slate-50/70 border border-slate-200 text-slate-800 text-[13px] font-medium rounded-md px-3 py-2 pr-7 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              {CLOUD_COVER_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Processing Level */}
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Processing Level
          </label>
          <div className="relative">
            <select
              value={processingLevel}
              onChange={(e) => setProcessingLevel(e.target.value)}
              className="w-full appearance-none bg-slate-50/70 border border-slate-200 text-slate-800 text-[13px] font-medium rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              {PROCESSING_LEVEL_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Search Button */}
        <button
          type="submit"
          className="h-[38px] px-6 bg-[#0f396b] hover:bg-[#0c2f59] active:bg-[#092445] text-white font-medium text-[13px] rounded-md shadow-sm transition-all flex items-center justify-center space-x-1.5 flex-shrink-0"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
        </button>
      </form>
    </div>
  );
};
