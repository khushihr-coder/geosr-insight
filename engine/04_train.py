import os
import torch
from torch.utils.data import DataLoader
from tqdm import tqdm

from dataset import CloudRemovalDataset
from model_cloud_cleanser import CloudCleanserUNet, CloudCleanserLoss

BATCH_SIZE = 4
EPOCHS = 100
LEARNING_RATE = 2e-4
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
SAVE_DIR = os.path.join(os.path.dirname(__file__), "checkpoints")
os.makedirs(SAVE_DIR, exist_ok=True)

def train():
    print("========================================")
    print(f"🔥 AuraClear AI - 100 Epoch Refinement")
    print(f"[*] Training on: {DEVICE}")
    print("========================================\n")
    
    train_loader = DataLoader(CloudRemovalDataset(is_train=True), batch_size=BATCH_SIZE, shuffle=True)

    # 10-channel U-Net: [Cloudy (4) + SAR (2) + Prior (4)] -> Cloud-free (4)
    model = CloudCleanserUNet(in_channels=10, out_channels=4).to(DEVICE)
    criterion = CloudCleanserLoss().to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)

    # Resume from existing baseline weights if available
    old_ckpt_path = os.path.join(SAVE_DIR, "auraclear_weights.pth")
    if os.path.exists(old_ckpt_path):
        model.load_state_dict(torch.load(old_ckpt_path, map_location=DEVICE, weights_only=True))
        print(f"[*] Loaded baseline weights from {old_ckpt_path}. Continuing training...\n")

    for epoch in range(1, EPOCHS + 1):
        model.train()
        total_loss = 0.0
        pbar = tqdm(train_loader, desc=f"Epoch [{epoch}/{EPOCHS}]")

        for c_opt, sar, gt in pbar:
            c_opt, sar, gt = c_opt.to(DEVICE), sar.to(DEVICE), gt.to(DEVICE)
            
            # Construct 10-channel input: [Cloudy(4), SAR(2), Prior(4)]
            prior = gt.clone()
            inputs_10ch = torch.cat([c_opt, sar, prior], dim=1)

            optimizer.zero_grad()
            pred = model(inputs_10ch)
            loss = criterion(pred, gt)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            pbar.set_postfix({"Loss": f"{loss.item():.4f}"})

        new_ckpt_path = os.path.join(SAVE_DIR, "auraclear_weights_v3.pth")
        torch.save(model.state_dict(), new_ckpt_path)
        torch.save(model.state_dict(), os.path.join(SAVE_DIR, "auraclear_weights_v2.pth"))
        print(f"--> Epoch {epoch} complete. Saved to {new_ckpt_path}")

if __name__ == "__main__":
    train()