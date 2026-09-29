import os
import torch
from torch.utils.data import Dataset
import numpy as np
from PIL import Image

class WorldStratDataset(Dataset):
    """
    Loads paired Sentinel-2 low-res inputs and high-res ground truth 
    from the WorldStrat / Kaggle directory structure.
    """
    def __init__(self, data_dir, is_train=True):
        self.input_dir = os.path.join(data_dir, "inputs")
        self.target_dir = os.path.join(data_dir, "targets")
        
        self.files = sorted([f for f in os.listdir(self.input_dir) if f.endswith(('.png', '.jpg', '.tif', '.npy'))])
        print(f"[*] Loaded {len(self.files)} samples from WorldStrat dataset at {data_dir}")

    def __len__(self):
        return len(self.files)

    def __getitem__(self, idx):
        filename = self.files[idx]
        in_path = os.path.join(self.input_dir, filename)
        tgt_path = os.path.join(self.target_dir, filename)
        
        if filename.endswith('.npy'):
            inputs = np.load(in_path) # Shape: (10, H, W)
            target = np.load(tgt_path) # Shape: (4, H*3, W*3)
            in_tensor = torch.from_numpy(inputs).float()
            target_tensor = torch.from_numpy(target).float()
        else:
            in_img = Image.open(in_path).convert('RGB')
            tgt_img = Image.open(tgt_path).convert('RGB')
            
            in_tensor = torch.from_numpy(np.array(in_img)).permute(2, 0, 1).float() / 255.0
            target_tensor = torch.from_numpy(np.array(tgt_img)).permute(2, 0, 1).float() / 255.0
            
            # Pad 3-channel input to 10-channel format to match model expectation
            if in_tensor.shape[0] == 3:
                padding = torch.zeros(7, in_tensor.shape[1], in_tensor.shape[2])
                in_tensor = torch.cat([in_tensor, padding], dim=0)

        return in_tensor, target_tensor