import os
import sys
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from model_super_resolution import SuperResolutionCleanser

EPOCHS = 60
BATCH_SIZE = 4
LEARNING_RATE = 2e-4
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
SAVE_DIR = os.path.join(os.path.dirname(__file__), "checkpoints")
os.makedirs(SAVE_DIR, exist_ok=True)

class GradientLoss(nn.Module):
    """Computes image gradients (Sobel filters) to penalize blur and enforce sharp edges."""
    def __init__(self):
        super(GradientLoss, self).__init__()
        kernel_x = torch.tensor([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=torch.float32).unsqueeze(0).unsqueeze(0)
        kernel_y = torch.tensor([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=torch.float32).unsqueeze(0).unsqueeze(0)
        self.register_buffer('weight_x', kernel_x)
        self.register_buffer('weight_y', kernel_y)

    def forward(self, preds, targets):
        loss = 0.0
        b, c, h, w = preds.shape
        for i in range(c):
            p_ch = preds[:, i:i+1, :, :]
            t_ch = targets[:, i:i+1, :, :]
            
            px = F.conv2d(p_ch, self.weight_x, padding=1)
            py = F.conv2d(p_ch, self.weight_y, padding=1)
            tx = F.conv2d(t_ch, self.weight_x, padding=1)
            ty = F.conv2d(t_ch, self.weight_y, padding=1)
            
            loss += F.l1_loss(px, tx) + F.l1_loss(py, ty)
        return loss / c

class SuperResDataset(Dataset):
    def __init__(self, data_dir=None, num_samples=300):
        if data_dir is None:
            data_dir = os.path.join(os.path.dirname(__file__), "data", "patches")
        self.files = [os.path.join(data_dir, f) for f in os.listdir(data_dir) if f.endswith('.npz')]
        self.num_samples = num_samples
        self.patches = [np.load(f)['arr_0'] for f in self.files]
        print(f"[*] Loaded {len(self.patches)} multi-spectral regions from {data_dir}")

    def __len__(self):
        return self.num_samples

    def __getitem__(self, idx):
        patch = self.patches[idx % len(self.patches)]
        
        _, h, w = patch.shape
        top = np.random.randint(0, h - 192 + 1)
        left = np.random.randint(0, w - 192 + 1)
        crop = patch[:, top:top+192, left:left+192].copy()

        if np.random.rand() > 0.5:
            crop = np.flip(crop, axis=1).copy()
        if np.random.rand() > 0.5:
            crop = np.flip(crop, axis=2).copy()

        opt_hr = torch.from_numpy(crop[0:4]).float().clamp(0.0, 1.0)
        sar_hr = torch.from_numpy(crop[4:6]).float().clamp(0.0, 1.0)

        opt_lr = F.interpolate(opt_hr.unsqueeze(0), size=(64, 64), mode='bicubic', align_corners=False).squeeze(0).clamp(0.0, 1.0)
        sar_lr = F.interpolate(sar_hr.unsqueeze(0), size=(64, 64), mode='bilinear', align_corners=False).squeeze(0).clamp(0.0, 1.0)
        prior_lr = opt_lr.clone()

        inputs_10ch = torch.cat([opt_lr, sar_lr, prior_lr], dim=0)
        targets_4ch = opt_hr

        return inputs_10ch, targets_4ch

def train_super_resolution():
    print("========================================")
    print("[*] AuraClear-SR: Sharpness-Optimized Training")
    print(f"[*] Device: {DEVICE.upper()} | Target Resolution: ~3.3m (3x PixelShuffle)")
    print("========================================\n")

    dataset = SuperResDataset(num_samples=400)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    model = SuperResolutionCleanser(in_channels=10, out_channels=4).to(DEVICE)
    
    criterion_l1 = nn.L1Loss()
    criterion_gradient = GradientLoss().to(DEVICE)
    
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)

    for epoch in range(1, EPOCHS + 1):
        model.train()
        running_loss = 0.0
        pbar = tqdm(dataloader, desc=f"Epoch [{epoch}/{EPOCHS}]", leave=False)

        for inputs, targets in pbar:
            inputs, targets = inputs.to(DEVICE), targets.to(DEVICE)

            optimizer.zero_grad()
            outputs = model(inputs)
            
            # Hybrid Loss: L1 Pixel Loss + Gradient Edge Loss (for sharpness) + Color Matching
            loss_pixel = criterion_l1(outputs, targets)
            loss_edge = criterion_gradient(outputs, targets)
            loss_color = torch.mean(torch.abs(outputs.mean(dim=[-2, -1]) - targets.mean(dim=[-2, -1])))
            
            loss = loss_pixel + 2.5 * loss_edge + 1.5 * loss_color
            
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            pbar.set_postfix({"Loss": f"{loss.item():.4f}"})

        avg_loss = running_loss / len(dataloader)
        if epoch % 5 == 0 or epoch == EPOCHS:
            print(f"Epoch {epoch:03d}/{EPOCHS} | Sharpness Loss: {avg_loss:.5f}")

        ckpt_path = os.path.join(SAVE_DIR, "auraclear_sr_weights_v1.pth")
        torch.save(model.state_dict(), ckpt_path)

    print("\n[+] Sharpness-Optimized Training Complete! Weights saved to checkpoints/auraclear_sr_weights_v1.pth")

if __name__ == "__main__":
    train_super_resolution()