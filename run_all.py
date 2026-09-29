import subprocess
import sys
import time
import threading
import requests

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def start_api_server():
    """Runs the FastAPI server in the background."""
    subprocess.run([sys.executable, "engine/api_server.py"])

def run_interactive_pipeline():
    # Wait a moment for the server to spin up fully
    time.sleep(3)
    
    print("\n==================================================")
    print("🌍 GeoSR-Insight Interactive Pipeline Ready")
    print("==================================================")
    
    while True:
        print("\n[?] Enter polygon coordinates for GEE fetching (or type 'exit' to quit):")
        user_input = input("Coordinates format (e.g., [[72.8, 19.0], [72.9, 19.0], [72.9, 19.1], [72.8, 19.1]]): ").strip()
        
        if user_input.lower() == 'exit':
            print("[*] Exiting orchestrator...")
            break
            
        if not user_input:
            # Default sample coordinates if user just presses enter
            coords = [[72.8777, 19.0760], [72.8877, 19.0760], [72.8877, 19.0860], [72.8777, 19.0860]]
            print(f"[*] Using default sample coordinates: {coords}")
        else:
            try:
                import json
                coords = json.loads(user_input)
            except Exception as e:
                print(f"[!] Invalid format error: {e}. Please use valid JSON list of lists.")
                continue

        # Extract bbox from polygon coordinates
        if isinstance(coords, list) and len(coords) >= 3 and isinstance(coords[0], (list, tuple)):
            min_lon = min(p[0] for p in coords)
            min_lat = min(p[1] for p in coords)
            max_lon = max(p[0] for p in coords)
            max_lat = max(p[1] for p in coords)
            bbox_str = f"{min_lon:.4f},{min_lat:.4f},{max_lon:.4f},{max_lat:.4f}"
        else:
            bbox_str = str(coords)

        print("\n--------------------------------------------------")
        print("🚀 Sending request to backend pipeline...")
        print(f"   BBox: {bbox_str}")
        print("1. Fetching latest Sentinel-1 (SAR) & Sentinel-2 (Optical) from GEE...")
        print("2. Checking cloud coverage percentage...")
        print("3. Branching: Applying Cloud Removal / AuraClear-SR Upscaler...")
        print("--------------------------------------------------")
        
        try:
            # Send payload to FastAPI endpoint /api/process-polygon
            response = requests.post(
                "http://localhost:8000/api/process-polygon",
                data={"bbox": bbox_str}
            )
            if response.status_code == 200:
                data = response.json()
                print("✅ Pipeline executed successfully!")
                print(f"   - Job ID: {data.get('job_id')}")
                print(f"   - Cloud Coverage: {data.get('cloud_coverage_percentage')}%")
                print(f"   - Optical Date (S2): {data.get('acquisition_date_s2')}")
                print(f"   - SAR Date (S1): {data.get('acquisition_date_s1')}")
                print(f"   - Inference Time: {data.get('inference_time_seconds')}s")
                print(f"   - Download GeoTIFF: {data.get('download_url')}")
            else:
                print(f"[!] Server returned status code {response.status_code}: {response.text}")
        except requests.exceptions.ConnectionError:
            print("[!] Error: Could not connect to the API server. Make sure it's running.")

if __name__ == "__main__":
    # Start API server in a background thread
    server_thread = threading.Thread(target=start_api_server, daemon=True)
    server_thread.start()
    
    # Run the interactive terminal loop
    try:
        run_interactive_pipeline()
    except KeyboardInterrupt:
        print("\n[!] Shutting down master orchestrator.")