import os
import torch
import numpy as np
from PIL import Image
from model_super_resolution import SuperResolutionCleanser

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), "checkpoints", "auraclear_sr_weights_v1.pth")

def load_sr_model():
    model = SuperResolutionCleanser(in_channels=10, out_channels=4).to(DEVICE)
    if os.path.exists(CHECKPOINT_PATH):
        model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location=DEVICE))
        print(f"[*] Loaded AuraClear-SR weights from {CHECKPOINT_PATH}")
    else:
        print("[!] Warning: Checkpoint not found. Using untrained model weights.")
    model.eval()
    return model

def upscale_image(input_tensor_10ch, model):
    """
    Takes a 10-channel 10m Sentinel-2 patch and upscales it 3x to sub-4m resolution.
    """
    model.eval()
    with torch.no_grad():
        inputs = input_tensor_10ch.unsqueeze(0).to(DEVICE) # Add batch dimension [1, 10, H, W]
        output = model(inputs)  # [1, 4, H*3, H*3]
        
        # Convert back to CPU numpy image
        output_arr = output.squeeze(0).permute(1, 2, 0).cpu().numpy()
        output_arr = np.clip(output_arr * 255.0, 0, 255).astype(np.uint8)
        
        # Sentinel-2 channels: [0=B2(Blue), 1=B3(Green), 2=B4(Red), 3=B8(NIR)]
        # Map to authentic True-Color RGB [Red, Green, Blue]:
        return output_arr[:, :, [2, 1, 0]]

if __name__ == "__main__":
    sr_model = load_sr_model()
    print("[+] AuraClear-SR local inference pipeline is ready!")