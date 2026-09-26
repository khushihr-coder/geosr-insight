import os
import calendar
import requests
from tqdm import tqdm

# -----------------------------------------------------------------
# CDSE CONFIGURATION
# -----------------------------------------------------------------
USERNAME = "tanmaypatel723@gmail.com"
PASSWORD = "Tanmay_03111845"

# Target Bounding Box: [min_lon, min_lat, max_lon, max_lat] (Nashik Sector)
BBOX = [73.70, 19.85, 74.05, 20.15]

# Root directory on your Expansion (D:) drive
EXTERNAL_DRIVE_DIR = "D:/Sentinel_Data"

START_YEAR = 2022
END_YEAR = 2026
END_MONTH = 8  # Up to August 2026
SCENES_PER_MONTH = 1  # 1 best scene per constellation per month


def get_token(username, password):
    url = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
    payload = {
        "client_id": "cdse-public",
        "username": username,
        "password": password,
        "grant_type": "password"
    }
    resp = requests.post(url, data=payload)
    if resp.status_code != 200:
        raise PermissionError(f"Authentication failed ({resp.status_code}): {resp.text}")
    print("[+] Successfully authenticated with Copernicus Data Space.")
    return resp.json()["access_token"]


def query_monthly_products(token, collection_name, start_date, end_date, bbox, extra_filters="", top_k=1):
    min_x, min_y, max_x, max_y = bbox
    poly = f"POLYGON(({min_x} {min_y}, {max_x} {min_y}, {max_x} {max_y}, {min_x} {max_y}, {min_x} {min_y}))"

    url = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
    filter_expr = (
        f"Collection/Name eq '{collection_name}' and "
        f"ContentDate/Start gt {start_date}T00:00:00.000Z and "
        f"ContentDate/Start lt {end_date}T23:59:59.999Z and "
        f"OData.CSC.Intersects(area=geography'SRID=4326;{poly}')"
    )
    if extra_filters:
        filter_expr += f" and {extra_filters}"

    query_url = f"{url}?$filter={filter_expr}&$top={top_k}&$orderby=ContentDate/Start desc"
    headers = {"Authorization": f"Bearer {token}"}

    resp = requests.get(query_url, headers=headers)
    if resp.status_code != 200:
        return []
    return resp.json().get("value", [])


def download_to_harddisk(token, product_id, product_name, dest_folder):
    """
    Downloads file directly to target D: folder with a live progress bar.
    Preserves Bearer token authorization across CDSE redirects.
    """
    os.makedirs(dest_folder, exist_ok=True)
    out_file = os.path.join(dest_folder, f"{product_name}.zip")

    # Skip if file already exists and is fully downloaded (> 100 MB)
    if os.path.exists(out_file) and os.path.getsize(out_file) > 1024 * 1024 * 100:
        print(f"    [-] Already exists ({os.path.getsize(out_file)/(1024*1024):.1f} MB), skipping.")
        return out_file

    download_url = f"https://zipper.dataspace.copernicus.eu/odata/v1/Products({product_id})/$value"
    headers = {"Authorization": f"Bearer {token}"}

    resp = requests.get(download_url, headers=headers, stream=True, allow_redirects=False)
    while resp.status_code in (301, 302, 303, 307):
        redirect_url = resp.headers["Location"]
        resp = requests.get(redirect_url, headers=headers, stream=True, allow_redirects=False)

    resp.raise_for_status()
    total_size = int(resp.headers.get("content-length", 0))

    with open(out_file, "wb") as f, tqdm(
        desc=f"    {product_name[:32]}...",
        total=total_size,
        unit="iB",
        unit_scale=True,
        unit_divisor=1024,
        leave=False
    ) as pbar:
        for chunk in resp.iter_content(chunk_size=1024 * 1024 * 8):  # 8 MB buffer
            if chunk:
                f.write(chunk)
                pbar.update(len(chunk))

    print(f"    [+] Saved: {out_file}")
    return out_file


def harvest_by_satellite_tree():
    token = get_token(USERNAME, PASSWORD)

    # Standard filters
    s2_filter = (
        "Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' and att/OData.CSC.StringAttribute/Value eq 'S2MSI2A') and "
        "Attributes/OData.CSC.DoubleAttribute/any(att:att/Name eq 'cloudCover' and att/OData.CSC.DoubleAttribute/Value le 25)"
    )
    s1_filter = "Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' and att/OData.CSC.StringAttribute/Value eq 'GRD')"

    for year in range(START_YEAR, END_YEAR + 1):
        last_m = END_MONTH if year == END_YEAR else 12

        for month in range(1, last_m + 1):
            num_days = calendar.monthrange(year, month)[1]
            start_date = f"{year}-{month:02d}-01"
            end_date = f"{year}-{month:02d}-{num_days:02d}"
            month_str = f"{month:02d}"

            # Dedicated directories for each satellite
            s2_save_path = os.path.join(EXTERNAL_DRIVE_DIR, "Sentinel-2", str(year), month_str)
            s1_save_path = os.path.join(EXTERNAL_DRIVE_DIR, "Sentinel-1", str(year), month_str)

            print(f"\n=================================================================")
            print(f"[*] Window: {year}-{month_str} ({start_date} to {end_date})")
            print(f"    S2 Destination: {s2_save_path}")
            print(f"    S1 Destination: {s1_save_path}")
            print(f"=================================================================")

            # ---------------- Sentinel-2 (Optical) ----------------
            s2_scenes = query_monthly_products(
                token, "SENTINEL-2", start_date, end_date, BBOX, extra_filters=s2_filter, top_k=SCENES_PER_MONTH
            )
            if not s2_scenes:
                fallback_filter = "Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' and att/OData.CSC.StringAttribute/Value eq 'S2MSI2A')"
                s2_scenes = query_monthly_products(
                    token, "SENTINEL-2", start_date, end_date, BBOX, extra_filters=fallback_filter, top_k=SCENES_PER_MONTH
                )

            for s2 in s2_scenes:
                print(f"  -> [Sentinel-2] Found: {s2['Name']}")
                download_to_harddisk(token, s2["Id"], s2["Name"], s2_save_path)

            # ---------------- Sentinel-1 (SAR) ----------------
            s1_scenes = query_monthly_products(
                token, "SENTINEL-1", start_date, end_date, BBOX, extra_filters=s1_filter, top_k=SCENES_PER_MONTH
            )

            for s1 in s1_scenes:
                print(f"  -> [Sentinel-1] Found: {s1['Name']}")
                download_to_harddisk(token, s1["Id"], s1["Name"], s1_save_path)


if __name__ == "__main__":
    harvest_by_satellite_tree()