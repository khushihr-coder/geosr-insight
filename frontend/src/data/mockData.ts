export interface SatelliteScene {
  id: string;
  name: string;
  date: string;
  cloudCover: number;
  coordinates: string;
  polygon: [number, number][]; // [lat, lng]
  area: string;
  processingLevel: string;
  thumbnailType: 'mountain' | 'agri' | 'terrain' | 'forest' | 'sar';
}

export const RECENT_SCENES: SatelliteScene[] = [
  {
    id: 'scene-1',
    name: 'Landsat 9 OLI',
    date: '28 Sep 2024',
    cloudCover: 2,
    coordinates: '[[75.85, 32.70], [75.93, 32.70], [75.93, 32.78], [75.85, 32.78]]',
    polygon: [
      [32.70, 75.85],
      [32.70, 75.93],
      [32.78, 75.93],
      [32.78, 75.85],
    ],
    area: '~ 64.8 sq. km',
    processingLevel: 'Level-2 (Surface Reflectance)',
    thumbnailType: 'mountain',
  },
  {
    id: 'scene-2',
    name: 'Sentinel-2 MSI',
    date: '25 Sep 2024',
    cloudCover: 5,
    coordinates: '[[75.82, 32.68], [75.95, 32.68], [75.95, 32.82], [75.82, 32.82]]',
    polygon: [
      [32.68, 75.82],
      [32.68, 75.95],
      [32.82, 75.95],
      [32.82, 75.82],
    ],
    area: '~ 98.4 sq. km',
    processingLevel: 'Level-2A (Bottom of Atmosphere)',
    thumbnailType: 'agri',
  },
  {
    id: 'scene-3',
    name: 'Resourcesat-2 LISS IV',
    date: '10 Sep 2024',
    cloudCover: 1,
    coordinates: '[[75.84, 32.72], [75.91, 32.72], [75.91, 32.79], [75.84, 32.79]]',
    polygon: [
      [32.72, 75.84],
      [32.72, 75.91],
      [32.79, 75.91],
      [32.79, 75.84],
    ],
    area: '~ 42.6 sq. km',
    processingLevel: 'Level-2 (Precision Geo-referenced)',
    thumbnailType: 'terrain',
  },
  {
    id: 'scene-4',
    name: 'Cartosat-2',
    date: '05 Sep 2024',
    cloudCover: 0,
    coordinates: '[[75.86, 32.71], [75.92, 32.71], [75.92, 32.77], [75.86, 32.77]]',
    polygon: [
      [32.71, 75.86],
      [32.71, 75.92],
      [32.77, 75.92],
      [32.77, 75.86],
    ],
    area: '~ 31.2 sq. km',
    processingLevel: 'Level-1D (Ortho-rectified)',
    thumbnailType: 'forest',
  },
  {
    id: 'scene-5',
    name: 'Sentinel-1 SAR',
    date: '01 Sep 2024',
    cloudCover: 0,
    coordinates: '[[75.78, 32.65], [76.00, 32.65], [76.00, 32.85], [75.78, 32.85]]',
    polygon: [
      [32.65, 75.78],
      [32.65, 76.00],
      [32.85, 76.00],
      [32.85, 75.78],
    ],
    area: '~ 180.5 sq. km',
    processingLevel: 'Level-1 GRD (Ground Range Detected)',
    thumbnailType: 'sar',
  },
];

export const DATASET_OPTIONS = [
  'Landsat 9 OLI',
  'Sentinel-2 MSI',
  'Resourcesat-2 LISS IV',
  'Cartosat-2',
  'Sentinel-1 SAR',
  'EOS-04 (RISAT-1A)',
];

export const CLOUD_COVER_OPTIONS = [
  '≤ 5%',
  '≤ 10%',
  '≤ 20%',
  '≤ 30%',
  'Any',
];

export const PROCESSING_LEVEL_OPTIONS = [
  'Level-1 (Top of Atmosphere)',
  'Level-2 (Surface Reflectance)',
  'Level-2A (Atmospheric Corrected)',
  'Level-3 (Analysis Ready Data)',
];
