# GeoSR Satellite Intelligence Dashboard

## Build
- Replace the blank page with a full-screen, dark geospatial operations workspace.
- Add a command header with mission identity, system status, region selection, and GeoTIFF upload dialog.
- Build a map-centered split layout with a draggable before/after curtain, map controls, AOI drawing modes, coordinates, and operational overlays.
- Add left-side tasking controls for AOI, cloud cleansing, bands, date range, and a realistic four-stage 2.5-second processing run.
- Add right-side scientific scorecards, micro-charts, resolution telemetry, layer controls, detection overlays, and export actions.
- Make side panels collapsible and the workspace usable across desktop and mobile sizes.

## Visual direction
- Defense-grade dark interface using graphite/slate surfaces, fine tactical grid lines, compact typography, and restrained emerald, cyan, and amber signals.
- Use semantic design tokens throughout, with glass panels, crisp borders, dense data hierarchy, and limited motion.

## Technical details
- Use React state for the simulated workflow, comparison slider, modal, region presets, toggles, tabs, and AOI drawing interactions.
- Use an embedded interactive geospatial canvas with pan/zoom behavior and map-like rendered terrain imagery; preserve a no-backend demo experience.
- Add page-specific metadata and verify the main workflow, responsive layout, and current preview diagnostics.
