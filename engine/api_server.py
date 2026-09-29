"""
GeoSR Cloud Cleanser — FastAPI Server (AuraClear AI)
=====================================================
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
import math
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

# Import trained U-Net architecture from model_cloud_cleanser.py
from model_cloud_cleanser import CloudCleanserUNet  # noqa: E402

# Hook directly to the Kaggle weights
CKPT_PATH = ENGINE_DIR / "checkpoints" / "auraclear_weights_v3.pth"
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
_model: Optional[CloudCleanserUNet] = None

def get_model() -> CloudCleanserUNet:
    """Lazy-load and cache the 10-channel U-Net model on the appropriate device."""
    global _model
    if _model is None:
        logger.info("Loading CloudCleanserUNet (AuraClear) on %s ...", DEVICE)
        _model = CloudCleanserUNet(in_channels=10, out_channels=4).to(DEVICE)
        
        # Priority order of checkpoints to load
        candidates = [
            CKPT_PATH,
            ENGINE_DIR / "checkpoints" / "auraclear_weights_v3.pth",
            ENGINE_DIR / "checkpoints" / "auraclear_weights_v2.pth",
            ENGINE_DIR / "checkpoints" / "auraclear_weights.pth",
        ]
        loaded = False
        for p in candidates:
            if p.exists():
                _model.load_state_dict(
                    torch.load(str(p), map_location=DEVICE, weights_only=True)
                )
                logger.info("✅ Checkpoint loaded successfully: %s", p.name)
                loaded = True
                break
        if not loaded:
            logger.warning("⚠️ Checkpoint NOT found at %s — using random weights", CKPT_PATH)
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

def _to_rgb_png_bytes(img_array: np.ndarray, boost: float = 3.5) -> bytes:
    """
    Converts a 4-channel or 3-channel numpy array to PNG bytes with safe clipping
    to prevent white-out overflow.
    """
    arr = np.nan_to_num(img_array, nan=0.0)
    # Check if (C, H, W) or (H, W, C)
    if arr.ndim == 3 and arr.shape[0] in [3, 4]:
        # Sentinel-2 bands: [B2, B3, B4, (B8)] -> RGB: [B4, B3, B2]
        rgb = np.stack([arr[2], arr[1], arr[0]], axis=-1)
    elif arr.ndim == 3 and arr.shape[-1] in [3, 4]:
        rgb = arr[:, :, [2, 1, 0]] if arr.shape[-1] >= 3 else arr
    else:
        rgb = arr

    # Safely clip first, apply boost safely, then clip strictly between 0.0 and 1.0 to avoid white-outs
    rgb = np.clip(rgb, 0.0, 1.0)
    rgb = np.clip(rgb * boost, 0.0, 1.0)
    img_uint8 = (rgb * 255).astype(np.uint8)

    # Encode to PNG bytes via PIL
    pil_img = Image.fromarray(img_uint8)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()

def _sar_vv_png_bytes(vv: np.ndarray) -> bytes:
    """Convert single-band VV (H,W) -> grayscale PNG bytes."""
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
        np.save(str(path).replace(".tif", ".npy"), bands_chw)

def _run_inference(cloudy_opt: np.ndarray, sar: np.ndarray, prior_opt: Optional[np.ndarray] = None) -> np.ndarray:
    """
    Run cloud removal inference using the 10-channel U-Net.
    Channels: [Cloudy Optical (4) + SAR (2) + Prior/Clear Optical (4)]
    """
    model = get_model()
    
    # If no separate prior scene is provided, fallback to cloudy_opt for context
    if prior_opt is None:
        prior_opt = cloudy_opt

    # Pad each array to multiples of 16 for clean pooling
    cloudy_opt_padded, (orig_h, orig_w) = _pad_to_multiple(cloudy_opt, 16)
    sar_padded, _ = _pad_to_multiple(sar, 16)
    prior_opt_padded, _ = _pad_to_multiple(prior_opt, 16)

    # Concatenate into the exact 10-channel layout trained on Kaggle
    input_10ch = np.concatenate([cloudy_opt_padded, sar_padded, prior_opt_padded], axis=0)
    in_tensor = torch.from_numpy(input_10ch).unsqueeze(0).float().to(DEVICE)

    with torch.no_grad():
        result = model(in_tensor).squeeze(0).cpu().numpy()

    # Crop out padding to restore original dimensions
    result = result[:, :orig_h, :orig_w]

    del in_tensor
    if DEVICE == "cuda":
        torch.cuda.empty_cache()
    return result

def natural_cloud_blending(original_image, reconstructed_image, cloud_mask=None) -> np.ndarray:
    """
    Blends the reconstructed cloud-removal output ONLY where clouds exist,
    preserving 100% of the original clear pixels to maintain a natural look.
    """
    orig_t = torch.from_numpy(original_image).float() if isinstance(original_image, np.ndarray) else original_image.float()
    recon_t = torch.from_numpy(reconstructed_image).float() if isinstance(reconstructed_image, np.ndarray) else reconstructed_image.float()

    if cloud_mask is None:
        rgb_mean = orig_t[:3].mean(dim=0, keepdim=True)
        blue_band = orig_t[0:1]
        cloud_mask = ((rgb_mean > 0.22) | (blue_band > 0.25)).float()
    elif isinstance(cloud_mask, np.ndarray):
        cloud_mask = torch.from_numpy(cloud_mask).float()

    if cloud_mask.dim() == 2:
        cloud_mask = cloud_mask.unsqueeze(0)

    kernel = torch.ones((1, 1, 5, 5), dtype=torch.float32) / 25.0
    smoothed_mask = torch.nn.functional.conv2d(cloud_mask.unsqueeze(0), kernel, padding=2).squeeze(0).clamp(0.0, 1.0)
    blended = (1.0 - smoothed_mask) * orig_t + smoothed_mask * recon_t

    return blended.numpy() if isinstance(original_image, np.ndarray) else blended

def _compute_cloud_percentage_from_optical(opt_bands: np.ndarray) -> float:
    """Estimate cloud coverage from optical bands heuristically."""
    rgb_mean = np.mean(opt_bands[:3], axis=0)
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

def enforce_10m_bbox(bbox: list[float], max_dim: int = 384) -> tuple[list[float], int, int]:
    """
    Forces the bounding box to strictly align with Sentinel's 10m/pixel resolution.
    Clamps max_dim dynamically based on latitude so rasterization boundary padding
    never exceeds GEE's 262,144 ceiling anywhere on Earth (e.g. Jammu & Kashmir 32.7°+).
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    center_lat = (min_lat + max_lat) / 2.0
    center_lon = (min_lon + max_lon) / 2.0

    cos_lat = max(0.15, math.cos(math.radians(abs(center_lat))))
    m_per_deg_lat = 111320.0
    m_per_deg_lon = 111320.0 * cos_lat

    width_m = (max_lon - min_lon) * m_per_deg_lon
    height_m = (max_lat - min_lat) * m_per_deg_lat

    cols = int(round(width_m / 10.0))
    rows = int(round(height_m / 10.0))

    # In GEE, sampleRectangle with EPSG:4326 scale=10 samples cols_sample = cols / cos_lat
    # Total sampled pixels = (cols * rows) / cos_lat.
    # To stay strictly below 220,000 pixels (limit is 262,144):
    safe_max = int(math.sqrt(220000.0 * cos_lat))
    effective_max = min(max_dim, safe_max)
    effective_max = max(16, (effective_max // 16) * 16)

    cols = min(cols, effective_max)
    rows = min(rows, effective_max)

    # Force dimensions to be cleanly divisible by 16 for U-Net pooling
    cols = max(16, (cols // 16) * 16)
    rows = max(16, (rows // 16) * 16)

    half_w = (cols * 10.0) / (2.0 * m_per_deg_lon)
    half_h = (rows * 10.0) / (2.0 * m_per_deg_lat)

    adj_min_lon = center_lon - half_w
    adj_max_lon = center_lon + half_w
    adj_min_lat = center_lat - half_h
    adj_max_lat = center_lat + half_h

    return [adj_min_lon, adj_min_lat, adj_max_lon, adj_max_lat], cols, rows

def _fetch_gee_data(
    bbox: list[float],
    start_date: str = None,
    end_date: str = None,
    project: str = DEFAULT_PROJECT,
) -> dict:
    """
    Dynamically fetches the latest 10m Sentinel data.
    """
    _init_gee(project)
    
    # BULLETPROOF OVERRIDE: Ignore frontend inputs completely.
    # Force the backend to strictly scan the last 60 days from TODAY.
    from datetime import datetime, timedelta
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=60)).strftime('%Y-%m-%d')

    import ee

    # 2. 10m Resolution Enforcement (Strictly <= 384 to guarantee <= 220,000 pixels on GEE)
    adjusted_bbox, target_w, target_h = enforce_10m_bbox(bbox, max_dim=384)
    min_lon, min_lat, max_lon, max_lat = adjusted_bbox
    geom = ee.Geometry.BBox(min_lon, min_lat, max_lon, max_lat)

    # 3. Fetch LATEST Cloudy Optical (Added swath-edge filtering)
    s2_col = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(geom)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.gt("CLOUDY_PIXEL_PERCENTAGE", 15))
        # Filter out images that don't fully cover the bounding box to prevent black edges
        .filter(ee.Filter.contains('.geo', geom))
        .sort("system:time_start", False)
    )

    s2_img = s2_col.first()
    if s2_img.getInfo() is None:
        # Fallback if the strict contains() filter drops everything
        s2_img = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(geom)
            .filterDate(start_date, end_date)
            .sort("system:time_start", False)
            .first()
        )
        if s2_img.getInfo() is None:
            raise ValueError(f"No Sentinel-2 imagery found between {start_date} and {end_date}.")

    s2_info = s2_img.getInfo()
    s2_date = ee.Date(s2_img.get("system:time_start"))
    s2_date_str = s2_date.format("YYYY-MM-dd").getInfo()
    cloud_pct_meta = float(s2_info["properties"].get("CLOUDY_PIXEL_PERCENTAGE", 0))
    opt_img = s2_img.select(["B2", "B3", "B4", "B8"]).divide(10000.0)

    # ── Cloud mask from QA60 ────────────────────────────────────
    qa60 = s2_img.select("QA60")
    cloud_bitmask = 1 << 10
    cirrus_bitmask = 1 << 11
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

    sar_vv = s1_img.select("VV").clamp(-30.0, 0.0).add(30.0).divide(30.0)
    sar_vh = s1_img.select("VH").clamp(-35.0, 0.0).add(35.0).divide(35.0)
    sar_img = ee.Image.cat([sar_vv, sar_vh])

    # ── Sample pixels ───────────────────────────────────────────
    # 2. Resample optical & SAR at strictly 10m native resolution
    stacked = ee.Image.cat([opt_img, sar_img]).clip(geom).reproject(crs='EPSG:4326', scale=10)
    sample = stacked.sampleRectangle(region=geom, defaultValue=0)
    b2 = np.array(sample.get("B2").getInfo(), dtype=np.float32)
    b3 = np.array(sample.get("B3").getInfo(), dtype=np.float32)
    b4 = np.array(sample.get("B4").getInfo(), dtype=np.float32)
    b8 = np.array(sample.get("B8").getInfo(), dtype=np.float32)
    vv = np.array(sample.get("VV").getInfo(), dtype=np.float32)
    vh = np.array(sample.get("VH").getInfo(), dtype=np.float32)

    max_dim = 512
    h, w = b2.shape
    h = min(h, max_dim)
    w = min(w, max_dim)
    optical = np.stack([b2[:h, :w], b3[:h, :w], b4[:h, :w], b8[:h, :w]], axis=0)
    sar = np.stack([vv[:h, :w], vh[:h, :w]], axis=0)
    optical = np.nan_to_num(optical, nan=0.0)
    sar = np.nan_to_num(sar, nan=0.0)

    # ── Fetch Prior Clear Optical Scene (Historical context for 10-ch input) ──
    try:
        s2_clear_col = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(geom)
            .filterDate(s2_date.advance(-180, "day"), s2_date.advance(180, "day"))
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 15))
            .sort("CLOUDY_PIXEL_PERCENTAGE")
        )
        s2_clear_img = s2_clear_col.median()
        clear_sample = (
            s2_clear_img.select(["B2", "B3", "B4", "B8"])
            .divide(10000.0)
            .clip(geom)
            .reproject(crs='EPSG:4326', scale=10)
            .sampleRectangle(region=geom, defaultValue=0)
        )
        cb2 = np.array(clear_sample.get("B2").getInfo(), dtype=np.float32)[:h, :w]
        cb3 = np.array(clear_sample.get("B3").getInfo(), dtype=np.float32)[:h, :w]
        cb4 = np.array(clear_sample.get("B4").getInfo(), dtype=np.float32)[:h, :w]
        cb8 = np.array(clear_sample.get("B8").getInfo(), dtype=np.float32)[:h, :w]
        prior_optical = np.stack([cb2, cb3, cb4, cb8], axis=0)
        prior_optical = np.nan_to_num(prior_optical, nan=0.0)
        
        # Replace any missing/zero boundary pixels with the authentic scene median ground reflectance
        # (never inject cloudy pixels from the optical image)
        valid_mask = (prior_optical > 0.01) & (prior_optical < 0.8)
        if valid_mask.any():
            for c in range(4):
                c_valid = prior_optical[c][valid_mask[c]]
                c_med = float(np.median(c_valid)) if len(c_valid) > 0 else 0.12
                prior_optical[c] = np.where(prior_optical[c] < 0.005, c_med, prior_optical[c])
        prior_optical = np.clip(prior_optical, 0.0, 1.0)
    except Exception:
        prior_optical = np.clip(optical, 0.0, 1.0)

    optical = np.clip(optical, 0.0, 1.0)
    sar = np.clip(sar, 0.0, 1.0)

    return {
        "optical": optical,
        "sar": sar,
        "prior_optical": prior_optical,
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
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    project: Optional[str] = Form(DEFAULT_PROJECT),
):
    """Process a polygon / bounding box via GEE fetch + 10-ch U-Net inference."""
    t_start = time.perf_counter()
    job_id = uuid.uuid4().hex[:12]
    try:
        if bbox:
            coords = [float(c.strip()) for c in bbox.split(",")]
            if len(coords) != 4:
                raise ValueError("bbox must have exactly 4 values: min_lon,min_lat,max_lon,max_lat")
        elif geojson:
            import json
            gj = json.loads(geojson)
            coords_arr = gj.get("coordinates", [[]])[0]
            lons = [p[0] for p in coords_arr]
            lats = [p[1] for p in coords_arr]
            coords = [min(lons), min(lats), max(lons), max(lats)]
        else:
            coords = [73.78, 19.95, 73.81, 19.98]

        logger.info("[%s] Processing bbox=%s dates=%s->%s", job_id, coords, start_date, end_date)
        
        # ── Fetch from GEE ──────────────────────────────────────
        gee_data = _fetch_gee_data(coords, start_date, end_date, project)
        cloudy_opt = gee_data["optical"]
        sar = gee_data["sar"]
        prior_opt = gee_data["prior_optical"]

        # ── Run 10-channel U-Net inference ──────────────────────
        raw_cleansed = _run_inference(cloudy_opt, sar, prior_opt)
        # Inpaint only cloudy regions, preserving 100% of authentic clear pixels
        cleansed = natural_cloud_blending(cloudy_opt, raw_cleansed)

        # ── Generate outputs ────────────────────────────────────
        job_dir = OUTPUT_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        cloudy_png = _to_rgb_png_bytes(cloudy_opt)
        sar_png = _sar_vv_png_bytes(sar[0])
        clean_png = _to_rgb_png_bytes(cleansed, boost=3.5) # <-- Fix applied here

        (job_dir / "cloudy.png").write_bytes(cloudy_png)
        (job_dir / "sar_vv.png").write_bytes(sar_png)
        (job_dir / "cloud_free.png").write_bytes(clean_png)

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
    """Process a user-uploaded multi-band GeoTIFF."""
    t_start = time.perf_counter()
    job_id = uuid.uuid4().hex[:12]
    if not file.filename or not file.filename.lower().endswith((".tif", ".tiff")):
        raise HTTPException(status_code=400, detail="Only .tif/.tiff files accepted")
    try:
        from rasterio.io import MemoryFile
        contents = await file.read()
        job_dir = OUTPUT_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        upload_path = job_dir / file.filename
        upload_path.write_bytes(contents)

        with MemoryFile(contents) as memfile:
            with memfile.open() as dataset:
                bands = dataset.read().astype(np.float32)
                bounds = list(dataset.bounds)
                num_bands = bands.shape[0]

                if bands.max() > 1.0:
                    bands = bands / 10000.0
                    bands = np.clip(bands, 0.0, 1.0)

                prior_opt = None
                if num_bands >= 10:
                    optical = bands[:4]
                    sar = bands[4:6]
                    prior_opt = bands[6:10]
                elif num_bands >= 6:
                    optical = bands[:4]
                    sar = bands[4:6]
                elif num_bands >= 4:
                    optical = bands[:4]
                    bbox = [bounds[0], bounds[1], bounds[2], bounds[3]]
                    gee_data = _fetch_gee_data(bbox)
                    sar = gee_data["sar"]
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
        cleansed = _run_inference(optical, sar, prior_opt)

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

@app.get("/outputs/{job_id}/{filename}")
async def download_output(job_id: str, filename: str):
    """Download a generated output file."""
    file_path = OUTPUT_DIR / job_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(file_path), filename=filename)

if __name__ == "__main__":
    import uvicorn
    get_model()
    logger.info("Starting Cloud Cleanser API on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")