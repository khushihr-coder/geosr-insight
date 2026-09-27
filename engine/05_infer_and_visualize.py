
import os
import torch
import numpy as np
import matplotlib.pyplot as plt
from scipy.ndimage import zoom
from model_cloud_cleanser import SAROpticalCloudCleanser

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CKPT_PATH = os.path.join(os.path.dirname(__file__), "checkpoints", "cloud_cleanser_latest.pth")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "patches")
OUT_DIR = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(OUT_DIR, exist_ok=True)

def generate_synthetic_clouds(h, w):
    noise = np.random.randn(h // 16, w // 16)
    mask = zoom(noise, 16, order=1)
    mask = (mask - mask.min()) / (mask.max() - mask.min() + 1e-6)
    return np.clip((mask - 0.25) / 0.75, 0.0, 1.0)[np.newaxis, :, :].astype(np.float32)

def calculate_psnr(pred, gt):
    mse = np.mean((pred - gt) ** 2)
    if mse == 0:
        return 100.0
    return 20 * np.log10(1.0 / np.sqrt(mse))

def run_evaluation():
    model = SAROpticalCloudCleanser().to(DEVICE)
    model.load_state_dict(torch.load(CKPT_PATH, map_location=DEVICE))
    model.eval()

    sample_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.npz')]
    if not sample_files:
        print("[-] No patch files found in data/patches.")
        return

    test_file = sample_files[0]
    data = np.load(os.path.join(DATA_DIR, test_file))['arr_0']

    gt_opt = data[0:4, :, :].copy()
    sar = data[4:6, :, :].copy()

    cloud_mask = generate_synthetic_clouds(gt_opt.shape[1], gt_opt.shape[2])
    cloudy_opt = gt_opt * (1.0 - cloud_mask) + 0.9 * cloud_mask

    in_opt = torch.from_numpy(cloudy_opt).unsqueeze(0).to(DEVICE)
    in_sar = torch.from_numpy(sar).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        pred = model(in_opt, in_sar).squeeze(0).cpu().numpy()

    psnr_score = calculate_psnr(pred, gt_opt)
    print(f"[+] Evaluation on '{test_file}':")
    print(f"    Reconstruction PSNR: {psnr_score:.2f} dB")

    def to_rgb(arr):
        rgb = np.stack([arr[2], arr[1], arr[0]], axis=-1)
        return np.clip(rgb * 3.5, 0.0, 1.0)

    cloudy_rgb = to_rgb(cloudy_opt)
    pred_rgb = to_rgb(pred)
    gt_rgb = to_rgb(gt_opt)
    sar_vv = np.clip(sar[0], 0.0, 1.0)

    fig, axes = plt.subplots(1, 4, figsize=(18, 5))
    axes[0].imshow(cloudy_rgb)
    axes[0].set_title("Input (Cloud Obscured)")
    axes[0].axis("off")

    axes[1].imshow(sar_vv, cmap="gray")
    axes[1].set_title("Sentinel-1 SAR Prior (VV)")
    axes[1].axis("off")

    axes[2].imshow(pred_rgb)
    axes[2].set_title(f"Reconstructed (PSNR: {psnr_score:.1f} dB)")
    axes[2].axis("off")

    axes[3].imshow(gt_rgb)
    axes[3].set_title("Ground Truth (Target)")
    axes[3].axis("off")

    out_file = os.path.join(OUT_DIR, "reconstruction_evaluation.png")
    plt.tight_layout()
    plt.savefig(out_file, dpi=300)
    plt.close()
    print(f"[+] Visual comparison saved to: {out_file}")

if __name__ == "__main__":
    run_evaluation()
