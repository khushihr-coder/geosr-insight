# Technical Decisions

- Use MapLibre GL with an Esri World Imagery raster source and synchronized clipped layers for the interactive comparison map; this provides real map navigation without requiring project credentials.
- Keep the 2.5-second processing workflow and exports client-side with deterministic mock data; the requested experience explicitly requires no live backend.
- Cloud Cleanser backend (`engine/api_server.py`) runs as an optional FastAPI sidecar on port 8000. Set `VITE_CLOUD_API_URL=http://localhost:8000` to route requests to the real backend; otherwise the frontend uses deterministic mock data.
