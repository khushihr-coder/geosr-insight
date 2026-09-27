"""
GeoSR Cloud Cleanser — FastAPI Server
======================================
SAR-guided Sentinel-2 cloud removal engine REST API.

Endpoints:
  POST /api/process-polygon   – GEE fetch + inference on AOI
  POST /api/upload-geotiff    – User-uploaded GeoTIFF processing
  GET  /api/health            – Server / GPU status

Launch:
  python api_server.py            (defaults to 0.0.0.0:8000)
  uvicorn api_server:app --reload (development)
"""

from __future__ import annotations

import base64
import io
import logging
import os
import sys
import time
import traceback
import uuid
from pathlib import Path
from typing import Optional

import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

# ── Resolve project paths ──────────────────────────────────────────────
ENGINE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ENGINE_DIR))

from model_cloud_cleanser import SAROpticalCloudCleanser  # noqa: E402

CKPT_PATH = ENGINE_DIR / "checkpoints" / "cloud_cleanser_latest.pth"
OUTPUT_DIR = ENGINE_DIR / "outputs" / "api"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_PROJECT = "liquid-galaxy-469819-j8"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# ── Logging ─────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cloud-cleanser-api")

# ── App ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="GeoSR Cloud Cleanser API",
    description="SAR-guided Sentinel-2 cloud removal inference server",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated output files as static assets
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

# ── Model Singleton ─────────────────────────────────────────────────────
_model: Optional[SAROpticalCloudCleanser] = None


def get_model() -> SAROpticalCloudCleanser:
    """Lazy-load and cache the model on the appropriate device."""
    global _model
    if _model is None:
        logger.info("Loading SAROpticalCloudCleanser on %s ...", DEVICE)
        _model = SAROpticalCloudCleanser().to(DEVICE)
        if CKPT_PATH.exists():
            _model.load_state_dict(
                torch.load(str(CKPT_PATH), map_location=DEVICE, weights_only=True)
            )
            logger.info("Checkpoint loaded: %s", CKPT_PATH.name)
        else:
            logger.warning("Checkpoint NOT found at %s — using random weights", CKPT_PATH)
        _model.eval()
    return _model


# ── Helpers ─────────────────────────────────────────────────────────────

def _pad_to_multiple(arr: np.ndarray, multiple: int = 16) -> tuple[np.ndarray, tuple[int, int]]:
    """Pad H,W dims of (C,H,W) array to next multiple."""
    _, h, w = arr.shape
    pad_h = (multiple - h % multiple) % multiple
    pad_w = (multiple - w % multiple) % multiple
    if pad_h or pad_w:
        arr = np.pad(arr, ((0, 0), (0, pad_h), (0, pad_w)), mode="reflect")
    return arr, (h, w)


def _to_rgb_png_bytes(bands_chw: np.ndarray, boost: float = 3.5) -> bytes:
    """Convert (C≥3,H,W) → sRGB PNG bytes.  Uses bands [2,1,0] = R,G,B."""
    rgb = np.stack([bands_chw[2], bands_chw[1], bands_chw[0]], axis=-1)
    rgb = np.clip(rgb * boost, 0.0, 1.0)
    img = Image.fromarray((rgb * 255).astype(np.uint8))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _sar_vv_png_bytes(vv: np.ndarray) -> bytes:
    """Convert single-band VV (H,W) → grayscale PNG bytes."""
    gray = np.clip(vv, 0.0, 1.0)
    img = Image.fromarray((gray * 255).astype(np.uint8), mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _save_geotiff(bands_chw: np.ndarray, path: Path, bounds: list[float] | None = None):
    """Write a 4-band float32 GeoTIFF with EPSG:4326 CRS."""
    try:
        import rasterio
        from rasterio.transform import from_bounds

        c, h, w = bands_chw.shape
        if bounds:
            transform = from_bounds(bounds[0], bounds[1], bounds[2], bounds[3], w, h)
        else:
            # Fallback identity transform
            transform = from_bounds(0, 0, w, h, w, h)

        with rasterio.open(
            str(path),
            "w",
            driver="GTiff",
            height=h,
            width=w,
            count=c,
            dtype="float32",
            crs="EPSG:4326",
            transform=transform,
        ) as dst:
            for i in range(c):
                dst.write(bands_chw[i], i + 1)
        logger.info("GeoTIFF written: %s", path.name)
    except ImportError:
        logger.warning("rasterio not installed — skipping GeoTIFF export")
        # Write raw numpy fallback
        np.save(str(path).replace(".tif", ".npy"), bands_chw)


def _run_inference(cloudy_opt: np.ndarray, sar: np.ndarray) -> np.ndarray:
    """Run cloud removal inference. Handles padding & CUDA memory."""
    model = get_model()

    # Pad to multiples of 16
    cloudy_opt_padded, (orig_h, orig_w) = _pad_to_multiple(cloudy_opt, 16)
    sar_padded, _ = _pad_to_multiple(sar, 16)

    in_opt = torch.from_numpy(cloudy_opt_padded).unsqueeze(0).float().to(DEVICE)
    in_sar = torch.from_numpy(sar_padded).unsqueeze(0).float().to(DEVICE)

    with torch.no_grad():
        result = model(in_opt, in_sar).squeeze(0).cpu().numpy()

    # Unpad
    result = result[:, :orig_h, :orig_w]

    # Memory cleanup
    del in_opt, in_sar
    if DEVICE == "cuda":
        torch.cuda.empty_cache()

    return result


def _compute_cloud_percentage_from_optical(opt_bands: np.ndarray) -> float:
    """Estimate cloud coverage from optical bands heuristically.
    Uses simple brightness threshold on B2,B3,B4 average — clouds are bright."""
    rgb_mean = np.mean(opt_bands[:3], axis=0)  # Mean of B2,B3,B4
    # Surface reflectance is 0-1 scaled; clouds are typically > 0.3
    cloud_mask = rgb_mean > 0.25
    return float(np.mean(cloud_mask) * 100.0)


# ── Earth Engine Helpers ────────────────────────────────────────────────

def _init_gee(project: str = DEFAULT_PROJECT):
    """Initialize Google Earth Engine."""
    import ee
    try:
        ee.Initialize(project=project)
        logger.info("Earth Engine initialized (project=%s)", project)
    except Exception:
        logger.info("Authenticating Earth Engine via localhost...")
        ee.Authenticate(auth_mode="localhost")
        ee.Initialize(project=project)


def _fetch_gee_data(
    bbox: list[float],
    start_date: str = "2025-06-01",
    end_date: str = "2025-09-30",
    project: str = DEFAULT_PROJECT,
) -> dict:
    """
    Fetch Sentinel-2 cloudy + Sentinel-1 SAR for a bounding box.
    Returns dict with numpy arrays and metadata.
    """
    import ee

    _init_gee(project)

    min_lon, min_lat, max_lon, max_lat = bbox
    geom = ee.Geometry.BBox(min_lon, min_lat, max_lon, max_lat)

    # ── Sentinel-2 (cloudy scene) ───────────────────────────────
    s2_col = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(geom)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.gt("CLOUDY_PIXEL_PERCENTAGE", 20))
        .sort("CLOUDY_PIXEL_PERCENTAGE", False)
    )

    s2_img = s2_col.first()
    s2_info = s2_img.getInfo()
    if s2_info is None:
        raise ValueError("No cloudy Sentinel-2 imagery found for this AOI and date range.")

    s2_date = ee.Date(s2_img.get("system:time_start"))
    s2_date_str = s2_date.format("YYYY-MM-dd").getInfo()
    cloud_pct_meta = float(s2_info["properties"].get("CLOUDY_PIXEL_PERCENTAGE", 0))

    opt_img = s2_img.select(["B2", "B3", "B4", "B8"]).divide(10000.0)

    # ── Cloud mask from QA60 ────────────────────────────────────
    qa60 = s2_img.select("QA60")
    cloud_bitmask = 1 << 10  # Bit 10 = opaque clouds
    cirrus_bitmask = 1 << 11  # Bit 11 = cirrus
    cloud_mask_img = (
        qa60.bitwiseAnd(cloud_bitmask).gt(0)
        .Or(qa60.bitwiseAnd(cirrus_bitmask).gt(0))
    )
    cloud_pct_pixel = cloud_mask_img.reduceRegion(
        reducer=ee.Reducer.mean(), geometry=geom, scale=60, maxPixels=1e7
    ).getInfo()
    pixel_cloud_pct = float(cloud_pct_pixel.get("QA60", cloud_pct_meta / 100.0)) * 100.0

    # ── Sentinel-1 SAR ──────────────────────────────────────────
    s1_col = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(geom)
        .filterDate(s2_date.advance(-15, "day"), s2_date.advance(15, "day"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        .filter(ee.Filter.eq("instrumentMode", "IW"))
    )

    s1_img = s1_col.first()
    s1_info = s1_img.getInfo()
    if s1_info is None:
        # Broader temporal fallback
        s1_img = (
            ee.ImageCollection("COPERNICUS/S1_GRD")
            .filterBounds(geom)
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
            .sort("system:time_start", False)
            .first()
        )
        s1_info = s1_img.getInfo()

    s1_date_str = ee.Date(s1_img.get("system:time_start")).format("YYYY-MM-dd").getInfo()

    # Calibrate SAR dB → [0, 1]
    sar_vv = s1_img.select("VV").clamp(-30.0, 0.0).add(30.0).divide(30.0)
    sar_vh = s1_img.select("VH").clamp(-35.0, 0.0).add(35.0).divide(35.0)
    sar_img = ee.Image.cat([sar_vv, sar_vh])

    # ── Sample pixels ───────────────────────────────────────────
    stacked = ee.Image.cat([opt_img, sar_img]).clip(geom)
    sample = stacked.sampleRectangle(region=geom, defaultValue=0)

    b2 = np.array(sample.get("B2").getInfo(), dtype=np.float32)
    b3 = np.array(sample.get("B3").getInfo(), dtype=np.float32)
    b4 = np.array(sample.get("B4").getInfo(), dtype=np.float32)
    b8 = np.array(sample.get("B8").getInfo(), dtype=np.float32)
    vv = np.array(sample.get("VV").getInfo(), dtype=np.float32)
    vh = np.array(sample.get("VH").getInfo(), dtype=np.float32)

    # Stack — cap at 512px to avoid OOM
    max_dim = 512
    h, w = b2.shape
    h = min(h, max_dim)
    w = min(w, max_dim)

    optical = np.stack([b2[:h, :w], b3[:h, :w], b4[:h, :w], b8[:h, :w]], axis=0)
    sar = np.stack([vv[:h, :w], vh[:h, :w]], axis=0)
    optical = np.nan_to_num(optical, nan=0.0)
    sar = np.nan_to_num(sar, nan=0.0)

    return {
        "optical": optical,
        "sar": sar,
        "cloud_coverage_percentage": max(pixel_cloud_pct, cloud_pct_meta),
        "acquisition_date_s2": s2_date_str,
        "acquisition_date_s1": s1_date_str,
        "bbox": bbox,
    }


# ══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════


@app.get("/api/health")
async def health():
    """Server & GPU status."""
    gpu_info = {}
    if torch.cuda.is_available():
        gpu_info = {
            "cuda_available": True,
            "device_name": torch.cuda.get_device_name(0),
            "vram_allocated_mb": round(torch.cuda.memory_allocated(0) / 1e6, 1),
            "vram_reserved_mb": round(torch.cuda.memory_reserved(0) / 1e6, 1),
        }
    else:
        gpu_info = {"cuda_available": False, "device_name": "CPU", "vram_allocated_mb": 0}

    return {
        "status": "ok",
        "device": DEVICE,
        "model_loaded": _model is not None,
        "checkpoint": CKPT_PATH.name if CKPT_PATH.exists() else "NOT_FOUND",
        "gpu": gpu_info,
    }


@app.post("/api/process-polygon")
async def process_polygon(
    bbox: Optional[str] = Form(None),
    geojson: Optional[str] = Form(None),
    start_date: Optional[str] = Form("2025-06-01"),
    end_date: Optional[str] = Form("2025-09-30"),
    project: Optional[str] = Form(DEFAULT_PROJECT),
):
    """
    Process a polygon / bounding box via GEE fetch + model inference.

    Accepts either:
      - bbox: comma-separated "min_lon,min_lat,max_lon,max_lat"
      - geojson: GeoJSON polygon string (future)
    """
    t_start = time.perf_counter()
    job_id = uuid.uuid4().hex[:12]

    try:
        # Parse bbox
        if bbox:
            coords = [float(c.strip()) for c in bbox.split(",")]
            if len(coords) != 4:
                raise ValueError("bbox must have exactly 4 values: min_lon,min_lat,max_lon,max_lat")
        elif geojson:
            import json
            gj = json.loads(geojson)
            # Extract bbox from GeoJSON polygon coordinates
            coords_arr = gj.get("coordinates", [[]])[0]
            lons = [p[0] for p in coords_arr]
            lats = [p[1] for p in coords_arr]
            coords = [min(lons), min(lats), max(lons), max(lats)]
        else:
            # Default Nashik AOI
            coords = [73.78, 19.95, 73.81, 19.98]

        logger.info("[%s] Processing bbox=%s dates=%s→%s", job_id, coords, start_date, end_date)

        # ── Fetch from GEE ──────────────────────────────────────
        gee_data = _fetch_gee_data(coords, start_date, end_date, project)
        cloudy_opt = gee_data["optical"]
        sar = gee_data["sar"]

        # ── Run inference ───────────────────────────────────────
        cleansed = _run_inference(cloudy_opt, sar)

        # ── Generate outputs ────────────────────────────────────
        job_dir = OUTPUT_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        # PNG previews
        cloudy_png = _to_rgb_png_bytes(cloudy_opt)
        sar_png = _sar_vv_png_bytes(sar[0])
        clean_png = _to_rgb_png_bytes(cleansed)

        (job_dir / "cloudy.png").write_bytes(cloudy_png)
        (job_dir / "sar_vv.png").write_bytes(sar_png)
        (job_dir / "cloud_free.png").write_bytes(clean_png)

        # GeoTIFF
        tiff_path = job_dir / "cloud_free.tif"
        _save_geotiff(cleansed, tiff_path, coords)

        elapsed = time.perf_counter() - t_start

        return {
            "job_id": job_id,
            "cloud_coverage_percentage": round(gee_data["cloud_coverage_percentage"], 2),
            "acquisition_date_s2": gee_data["acquisition_date_s2"],
            "acquisition_date_s1": gee_data["acquisition_date_s1"],
            "inference_time_seconds": round(elapsed, 2),
            "previews": {
                "cloudy": f"data:image/png;base64,{base64.b64encode(cloudy_png).decode()}",
                "sar_vv": f"data:image/png;base64,{base64.b64encode(sar_png).decode()}",
                "cloud_free": f"data:image/png;base64,{base64.b64encode(clean_png).decode()}",
            },
            "download_url": f"/outputs/{job_id}/cloud_free.tif",
        }

    except Exception as exc:
        logger.error("[%s] Error: %s\n%s", job_id, exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/upload-geotiff")
async def upload_geotiff(file: UploadFile = File(...)):
    """
    Process a user-uploaded multi-band GeoTIFF.
    If SAR bands (5–6) present → direct inference.
    If only optical (4 bands) → fetch SAR from GEE using GeoTIFF bbox.
    """
    t_start = time.perf_counter()
    job_id = uuid.uuid4().hex[:12]

    if not file.filename or not file.filename.lower().endswith((".tif", ".tiff")):
        raise HTTPException(status_code=400, detail="Only .tif/.tiff files accepted")

    try:
        import rasterio
        from rasterio.io import MemoryFile

        contents = await file.read()
        job_dir = OUTPUT_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        # Save uploaded file
        upload_path = job_dir / file.filename
        upload_path.write_bytes(contents)

        with MemoryFile(contents) as memfile:
            with memfile.open() as dataset:
                bands = dataset.read().astype(np.float32)
                bounds = list(dataset.bounds)  # left, bottom, right, top
                num_bands = bands.shape[0]

                logger.info(
                    "[%s] Uploaded GeoTIFF: %d bands, %dx%d, bounds=%s",
                    job_id, num_bands, bands.shape[2], bands.shape[1], bounds,
                )

                # Normalize if needed (S2 DN values 0-10000)
                if bands.max() > 1.0:
                    bands = bands / 10000.0
                    bands = np.clip(bands, 0.0, 1.0)

                if num_bands >= 6:
                    # Has optical + SAR
                    optical = bands[:4]
                    sar = bands[4:6]
                elif num_bands >= 4:
                    # Optical only — fetch SAR from GEE
                    optical = bands[:4]
                    bbox = [bounds[0], bounds[1], bounds[2], bounds[3]]
                    gee_data = _fetch_gee_data(bbox)
                    sar = gee_data["sar"]
                    # Resize SAR to match optical dimensions
                    if sar.shape[1:] != optical.shape[1:]:
                        from PIL import Image as PILImage
                        sar_resized = np.zeros((2, optical.shape[1], optical.shape[2]), dtype=np.float32)
                        for i in range(2):
                            tmp = PILImage.fromarray(sar[i])
                            tmp = tmp.resize((optical.shape[2], optical.shape[1]), PILImage.BILINEAR)
                            sar_resized[i] = np.array(tmp)
                        sar = sar_resized
                else:
                    raise ValueError(f"GeoTIFF has {num_bands} bands; need at least 4 (B2,B3,B4,B8)")

        cloud_pct = _compute_cloud_percentage_from_optical(optical)
        cleansed = _run_inference(optical, sar)

        # Generate outputs
        cloudy_png = _to_rgb_png_bytes(optical)
        sar_png = _sar_vv_png_bytes(sar[0])
        clean_png = _to_rgb_png_bytes(cleansed)

        (job_dir / "cloudy.png").write_bytes(cloudy_png)
        (job_dir / "sar_vv.png").write_bytes(sar_png)
        (job_dir / "cloud_free.png").write_bytes(clean_png)

        tiff_path = job_dir / "cloud_free.tif"
        _save_geotiff(cleansed, tiff_path, bounds)

        elapsed = time.perf_counter() - t_start

        return {
            "job_id": job_id,
            "cloud_coverage_percentage": round(cloud_pct, 2),
            "acquisition_date_s2": "uploaded",
            "acquisition_date_s1": "uploaded" if num_bands >= 6 else "auto-fetched",
            "inference_time_seconds": round(elapsed, 2),
            "previews": {
                "cloudy": f"data:image/png;base64,{base64.b64encode(cloudy_png).decode()}",
                "sar_vv": f"data:image/png;base64,{base64.b64encode(sar_png).decode()}",
                "cloud_free": f"data:image/png;base64,{base64.b64encode(clean_png).decode()}",
            },
            "download_url": f"/outputs/{job_id}/cloud_free.tif",
        }

    except ImportError:
        raise HTTPException(status_code=500, detail="rasterio is required for GeoTIFF upload processing")
    except Exception as exc:
        logger.error("[%s] Upload error: %s\n%s", job_id, exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc))


# ── Static file serving for GeoTIFF downloads ──────────────────────────

@app.get("/outputs/{job_id}/{filename}")
async def download_output(job_id: str, filename: str):
    """Download a generated output file."""
    file_path = OUTPUT_DIR / job_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(file_path), filename=filename)


# ── Run ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    # Pre-load model at startup
    get_model()
    logger.info("Starting Cloud Cleanser API on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
