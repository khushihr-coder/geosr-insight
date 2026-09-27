import os
import torch
from torch.utils.data import DataLoader
from tqdm import tqdm

from dataset import CloudRemovalDataset
from model_cloud_cleanser import SAROpticalCloudCleanser, CloudCleanserLoss

BATCH_SIZE = 2
EPOCHS = 15
LEARNING_RATE = 2e-4
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
SAVE_DIR = os.path.join(os.path.dirname(__file__), "checkpoints")
os.makedirs(SAVE_DIR, exist_ok=True)

def train():
    print(f"[*] Training on: {DEVICE}")
    train_loader = DataLoader(CloudRemovalDataset(is_train=True), batch_size=BATCH_SIZE, shuffle=True)

    model = SAROpticalCloudCleanser().to(DEVICE)
    criterion = CloudCleanserLoss().to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)

    for epoch in range(1, EPOCHS + 1):
        model.train()
        total_loss = 0.0
        pbar = tqdm(train_loader, desc=f"Epoch [{epoch}/{EPOCHS}]")

        for c_opt, sar, gt in pbar:
            c_opt, sar, gt = c_opt.to(DEVICE), sar.to(DEVICE), gt.to(DEVICE)
            optimizer.zero_grad()
            pred = model(c_opt, sar)
            loss = criterion(pred, gt)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            pbar.set_postfix({"Loss": f"{loss.item():.4f}"})

        ckpt_path = os.path.join(SAVE_DIR, "cloud_cleanser_latest.pth")
        torch.save(model.state_dict(), ckpt_path)
        print(f"--> Epoch {epoch} complete. Saved to {ckpt_path}")

if __name__ == "__main__":
    train()