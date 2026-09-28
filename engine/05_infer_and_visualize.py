import os
import requests
import base64
import io
import matplotlib.pyplot as plt
from PIL import Image

print("========================================")
print("🌍 AuraClear AI - LIVE Earth Engine Fetch")
print("========================================\n")

# 1. Take custom input from the user
print("Enter bounding box coordinates to fetch live satellite data.")
print("Press Enter to use the default Nashik region (73.78, 19.95, 73.81, 19.98).")
bbox_input = input("Coordinates (min_lon, min_lat, max_lon, max_lat): ").strip()

if not bbox_input:
    bbox_input = "73.78, 19.95, 73.81, 19.98"

# We let the API automatically fetch the absolute latest image
print(f"\n[*] Reaching out to Google Earth Engine for bbox: {bbox_input}")
print("[*] (This takes 10-20 seconds depending on Google's servers...)")

# 2. Ping your running FastAPI backend
url = "http://localhost:8000/api/process-polygon"
payload = {
    "bbox": bbox_input,
    "start_date": "",
    "end_date": ""
}

try:
    response = requests.post(url, data=payload)
    
    if response.status_code == 200:
        data = response.json()
        print("\n✅ Inference Complete!")
        print(f"   - Cloud Coverage Found: {data.get('cloud_coverage_percentage')}%")
        print(f"   - Processing Time: {data.get('inference_time_seconds')}s")

        # 3. Decode the base64 images returned by your API
        def decode_b64_img(b64_str):
            header, encoded = b64_str.split(",", 1)
            return Image.open(io.BytesIO(base64.b64decode(encoded)))

        cloudy_img = decode_b64_img(data['previews']['cloudy'])
        sar_img = decode_b64_img(data['previews']['sar_vv'])
        clean_img = decode_b64_img(data['previews']['cloud_free'])

        # 4. Plot the REAL satellite data
        # Note: There is no "Ground Truth" panel here because in real life, the optical image is actually cloudy!
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        
        axes[0].imshow(cloudy_img)
        axes[0].set_title(f"Live Optical (Cloudy)\nDate: {data.get('acquisition_date_s2', 'N/A')}")
        axes[0].axis("off")

        axes[1].imshow(sar_img, cmap='gray')
        axes[1].set_title(f"Live SAR (Radar)\nDate: {data.get('acquisition_date_s1', 'N/A')}")
        axes[1].axis("off")

        axes[2].imshow(clean_img)
        axes[2].set_title("AuraClear Reconstructed")
        axes[2].axis("off")

        out_file = os.path.join(os.path.dirname(__file__), "outputs", "live_inference_result.png")
        plt.tight_layout()
        plt.savefig(out_file, dpi=300)
        plt.close()
        
        print(f"\n[+] Visual comparison of LIVE data saved to: {out_file}")
        
    else:
        print(f"\n❌ API Error {response.status_code}: {response.text}")

except Exception as e:
    print(f"\n❌ Connection Error: {e}")
    print("Make sure your 'api_server.py' is running in a separate terminal tab!")