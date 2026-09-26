import os
import ee
import numpy as np

# Initialize Earth Engine
try:
    ee.Initialize()
except Exception:
    # If a specific project is required, set it here:
    ee.Initialize(project=None)

OUT_DIR = os.path.join(os.path.dirname(__file__), "data", "patches")
os.makedirs(OUT_DIR, exist_ok=True)

BIOMES = {
    "nashik_agriculture": [73.80, 20.00],
    "mumbai_coastal":     [72.90, 19.10],
    "aligarh_plains":     [78.10, 27.90],
    "jodhpur_arid":       [73.05, 26.30],
    "dehradun_mountain":  [78.05, 30.35],
    "sundarbans_wetland": [88.85, 21.90]
}

def export_paired_patch(name, lon, lat, patch_pixels=256):
    point = ee.Geometry.Point([lon, lat])
    roi = point.buffer(patch_pixels * 5).bounds()  # ~2.56 km box (10m resolution)

    # 1. Clean Sentinel-2 Target (Surface Reflectance: B2, B3, B4, B8)
    s2_clean = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(roi)
                .filterDate("2024-01-01", "2024-04-30")
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 5))
                .first()
                .select(['B2', 'B3', 'B4', 'B8'])
                .divide(10000.0))  # Scale to [0.0, 1.0]

    # 2. Sentinel-1 SAR (Backscatter dB: VV, VH)
    s1_sar = (ee.ImageCollection("COPERNICUS/S1_GRD")
              .filterBounds(roi)
              .filter(ee.Filter.eq("instrumentMode", "IW"))
              .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
              .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
              .filterDate("2024-01-01", "2024-04-30")
              .first()
              .select(['VV', 'VH']))

    # Normalize SAR from roughly [-25dB, 0dB] to [0.0, 1.0]
    s1_sar_norm = s1_sar.add(25.0).divide(25.0).clamp(0.0, 1.0)

    # Stack: Bands 0-3 = Optical, Bands 4-5 = SAR
    stacked = s2_clean.addBands(s1_sar_norm)

    try:
        sample = stacked.sampleRectangle(region=roi, defaultValue=0).getInfo()
        properties = sample.get('properties', {})
        
        b2 = np.array(properties.get('B2', []))
        b3 = np.array(properties.get('B3', []))
        b4 = np.array(properties.get('B4', []))
        b8 = np.array(properties.get('B8', []))
        vv = np.array(properties.get('VV', []))
        vh = np.array(properties.get('VH', []))

        # Crop/resize to 256x256
        tensor = np.stack([b2[:256, :256], b3[:256, :256], b4[:256, :256], b8[:256, :256], 
                           vv[:256, :256], vh[:256, :256]], axis=0).astype(np.float32)

        out_path = os.path.join(OUT_DIR, f"{name}.npz")
        np.savez_compressed(out_path, tensor)
        print(f"[+] Successfully exported patch: {out_path} (Shape: {tensor.shape})")
    except Exception as e:
        print(f"[-] Failed for {name}: {e}")

if __name__ == "__main__":
    print("[*] Exporting multi-modal biome patches across India...")
    for biome, coords in BIOMES.items():
        export_paired_patch(biome, coords[0], coords[1])