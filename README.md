# GeoSR Insight

Create a modern, defense-grade satellite intelligence dashboard for "GeoSR: Satellite Super-Resolution Mapping (SIH 2026 - NTRO)". 

Use Tailwind CSS, Lucide-React icons, Radix UI / Shadcn UI components, and MapLibre GL / Leaflet for interactive geospatial map visualization.

The design aesthetic must be sleek, dark-mode first (slate-950 background, subtle border lines in slate-800, vibrant accents in emerald-500, cyan-400, and amber-500) mimicking a professional defense geospatial analytics interface like Palantir Foundry or Sentinel Hub.

### 1. Layout & Header
- **Top Navigation Bar:**
  - Left: Logo with a radar/satellite icon, titled "GeoSR AI | Sub-4m Super-Resolution Portal", with a badge saying "SIH PS ID: 26142 (NTRO)".
  - Center: Status indicators showing "Copernicus API: Connected (Active)", "GEE Compute: Online", "Inference Engine: RTX Ready (FP16)".
  - Right: Quick Region Selector dropdown ("Aligarh Agrarian Sector", "Mumbai Urban Corridor", "Nashik Border Zone", "Custom AOI") and an "Upload GeoTIFF" button opening a modal.

### 2. Main Workspace (Full-Screen Split GIS Layout)
The core viewport is a full-height interactive map with floating glassmorphism control panels:
- **Map Viewport (Center-Full):**
  - Interactive map centered on India (default coordinates around Nashik/Mumbai, zoom 12) with high-contrast dark-mode satellite base tiles.
  - Integrate a functional **Before / After Split Curtain Slider (Swipe Comparison)**:
    - Left side: "Raw Sentinel-2 Input (10m Native GSD)" - noticeably softer/pixelated appearance.
    - Right side: "Super-Resolved Product (2.5m Analysis-Ready)" - crisp building edges, clear linear roads, and sharp parcel boundaries.
  - A polygon drawing tool (Bounding Box / Freehand Polygon) allowing users to select an Area of Interest (AOI).

### 3. Floating Left Sidebar: "Tasking & Ingestion Panel"
- **AOI Selection Box:**
  - Tabs: "Draw on Map", "Enter Coordinates (BBox Lat/Lon)", "Pre-cached Demo Sectors".
  - Cloud Handling Toggle: "SAR-Guided Cloud Cleanser (Sentinel-1 Inpainting)" with an automatic toggle switch if cloud cover > 10%.
  - Multispectral Band Selector: Checklist for B02 (Blue), B03 (Green), B04 (Red), and B08 (NIR).
  - Date Range Picker with latest acquisition date badge.
  - Large Primary Action Button: "Run Super-Resolution (4x Enhance to 2.5m)" with loading spinner state and simulated progress bar ("Fetching GEE Tiles -> Inpainting Clouds -> Executing Multi-Spectral HAT -> Writing GeoTIFF").

### 4. Floating Right Sidebar: "Spectral & Downstream Intelligence Analytics"
- Collapsible analytics panel displaying real-time scientific telemetry for the current viewport:
  - **Resolution Metric:** Dynamic badge showing "10.0m GSD → 2.5m GSD (4x Spatial Upscale)".
  - **Scientific Quality Scorecard (Cards with micro-charts):**
    - PSNR: `33.4 dB` (Target: >32.5 dB)
    - SSIM: `0.892` (Target: >0.880)
    - Spectral Angle Mapper (SAM): `3.8°` (Preserved multi-spectral fidelity)
    - NDVI Drift: `Δ 0.012` (Zero radiometric corruption)
  - **Layer Toggles:**
    - Toggle 1: "Epistemic Uncertainty Heatmap" (Renders a glowing green-to-red confidence gradient overlay showing pixel-level model reliability).
    - Toggle 2: "Vegetation Index (NDVI Heatmap)".
    - Toggle 3: "Water Index (NDWI Heatmap)".
    - Toggle 4: "Downstream AI Extraction (YOLOv8-OBB)" displaying vectorized polygon bounding boxes over buildings and highlighted vector lines over roads, showing a "+28% mIoU Detection Gain".
  - **Export Footer:**
    - "Download 2.5m GeoTIFF (COG with CRS)" button.
    - "Export Vector GeoJSON (Roads & Buildings)" button.
    - "Generate NTRO Analytical PDF Report" button.

### 5. Interactive Demo Experience (Mock State)
- Include mock sample data so clicking "Run Super-Resolution" triggers a realistic 2.5-second processing state, smoothly revealing the 2.5m enhanced layer, updating the swipe curtain slider, and plotting the uncertainty map without requiring a live backend connection immediately.
- Make the UI completely responsive, polished, and free of placeholder text bugs.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ce5d696b-114d-4b7b-8594-656d7fa04e42).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
