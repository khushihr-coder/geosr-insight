
import os
import argparse
import ee
import torch
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image

from model_cloud_cleanser import SAROpticalCloudCleanser

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CKPT_PATH = os.path.join(os.path.dirname(__file__), "checkpoints", "cloud_cleanser_latest.pth")
OUT_DIR = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(OUT_DIR, exist_ok=True)
DEFAULT_PROJECT = "liquid-galaxy-469819-j8"

def init_gee(project=DEFAULT_PROJECT):
    try:
        ee.Initialize(project=project)
        print(f"[+] Earth Engine initialized with project: {project}")
    except Exception as e:
        print(f"[!] Standard initialization failed: {e}")
        print("[*] Authenticating via localhost...")
        ee.Authenticate(auth_mode='localhost')
        ee.Initialize(project=project)

def fetch_multimodal_aoi(geom, start_date="2025-06-01", end_date="2025-09-30"):
    print("[*] Querying cloudy Sentinel-2 and Sentinel-1 SAR pair from Earth Engine...")
    
    s2_col = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
              .filterBounds(geom)
              .filterDate(start_date, end_date)
              .filter(ee.Filter.gt("CLOUDY_PIXEL_PERCENTAGE", 50))
              .sort("CLOUDY_PIXEL_PERCENTAGE", False))
    
    s2_img = s2_col.first()
    if s2_img is None:
        raise RuntimeError("No cloudy Sentinel-2 imagery found in this date range.")

    s2_date = ee.Date(s2_img.get("system:time_start"))
    print(f"    [+] Found S2 Cloudy Scene: {s2_date.format('YYYY-MM-dd').getInfo()}")

    opt_tensor = s2_img.select(['B2', 'B3', 'B4', 'B8']).divide(10000.0)

    s1_col = (ee.ImageCollection("COPERNICUS/S1_GRD")
              .filterBounds(geom)
              .filterDate(s2_date.advance(-15, 'day'), s2_date.advance(15, 'day'))
              .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
              .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
              .filter(ee.Filter.eq('instrumentMode', 'IW')))
    
    s1_img = s1_col.first()
    if s1_img is None:
        s1_img = (ee.ImageCollection("COPERNICUS/S1_GRD")
                  .filterBounds(geom)
                  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                  .first())

    sar_vv = s1_img.select('VV').clamp(-30.0, 0.0).add(30.0).divide(30.0)
    sar_vh = s1_img.select('VH').clamp(-35.0, 0.0).add(35.0).divide(35.0)
    sar_tensor = ee.Image.cat([sar_vv, sar_vh])

    stacked = ee.Image.cat([opt_tensor, sar_tensor]).clip(geom)
    sample = stacked.sampleRectangle(region=geom, defaultValue=0)
    
    b2 = np.array(sample.get('B2').getInfo(), dtype=np.float32)
    b3 = np.array(sample.get('B3').getInfo(), dtype=np.float32)
    b4 = np.array(sample.get('B4').getInfo(), dtype=np.float32)
    b8 = np.array(sample.get('B8').getInfo(), dtype=np.float32)
    vv = np.array(sample.get('VV').getInfo(), dtype=np.float32)
    vh = np.array(sample.get('VH').getInfo(), dtype=np.float32)

    arr = np.stack([b2[:256, :256], b3[:256, :256], b4[:256, :256], b8[:256, :256], vv[:256, :256], vh[:256, :256]], axis=0)
    return np.nan_to_num(arr, nan=0.0)

def predict_aoi(bbox_coords=None, project=DEFAULT_PROJECT):
    init_gee(project)

    if bbox_coords:
        min_lon, min_lat, max_lon, max_lat = bbox_coords
        geom = ee.Geometry.BBox(min_lon, min_lat, max_lon, max_lat)
        region_name = "custom_aoi"
    else:
        geom = ee.Geometry.BBox(73.78, 19.95, 73.81, 19.98)
        region_name = "nashik_monsoon_cloud"

    data = fetch_multimodal_aoi(geom)
    cloudy_opt = data[0:4, :, :]
    sar = data[4:6, :, :]

    print(f"[*] Loading model on {DEVICE}...")
    model = SAROpticalCloudCleanser().to(DEVICE)
    model.load_state_dict(torch.load(CKPT_PATH, map_location=DEVICE))
    model.eval()

    in_opt = torch.from_numpy(cloudy_opt).unsqueeze(0).to(DEVICE)
    in_sar = torch.from_numpy(sar).unsqueeze(0).to(DEVICE)

    print("[*] Running cross-attention SAR reconstruction...")
    with torch.no_grad():
        cleansed_opt = model(in_opt, in_sar).squeeze(0).cpu().numpy()

    def to_rgb(t):
        rgb = np.stack([t[2], t[1], t[0]], axis=-1)
        return np.clip(rgb * 3.5, 0.0, 1.0)

    cloudy_rgb = to_rgb(cloudy_opt)
    sar_vv = np.clip(sar[0], 0.0, 1.0)
    cleansed_rgb = to_rgb(cleansed_opt)

    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    axes[0].imshow(cloudy_rgb)
    axes[0].set_title("Input (Live Cloudy Sentinel-2)")
    axes[0].axis("off")

    axes[1].imshow(sar_vv, cmap="gray")
    axes[1].set_title("Sentinel-1 SAR Penetration (VV)")
    axes[1].axis("off")

    axes[2].imshow(cleansed_rgb)
    axes[2].set_title("Reconstructed Cloud-Free Output")
    axes[2].axis("off")

    out_plot = os.path.join(OUT_DIR, f"{region_name}_cleansed.png")
    plt.tight_layout()
    plt.savefig(out_plot, dpi=300)
    plt.close()

    out_img = os.path.join(OUT_DIR, f"{region_name}_cloudfree_rgb.png")
    Image.fromarray((cleansed_rgb * 255).astype(np.uint8)).save(out_img)

    print(f"[+] Reconstruction successful!")
    print(f"    - Comparison plot: {out_plot}")
    print(f"    - Standalone image: {out_img}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--bbox", nargs=4, type=float, help="min_lon min_lat max_lon max_lat")
    parser.add_argument("--project", type=str, help="Google Cloud Project ID for Earth Engine", default=DEFAULT_PROJECT)
    args = parser.parse_args()

    predict_aoi(args.bbox, args.project)
