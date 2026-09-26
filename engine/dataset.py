import os
import torch
from torch.utils.data import Dataset
import numpy as np
from scipy.ndimage import zoom

class CloudRemovalDataset(Dataset):
    def __init__(self, data_dir="data/patches", is_train=True, simulate_clouds=True):
        self.simulate_clouds = simulate_clouds
        files = [os.path.join(data_dir, f) for f in os.listdir(data_dir) if f.endswith('.npz')]
        split_idx = max(1, int(0.8 * len(files)))
        self.file_list = files[:split_idx] if is_train else files[split_idx:]
        if len(self.file_list) == 0:
            self.file_list = files

    def __len__(self):
        return len(self.file_list) * 20  # Virtual augmentation multiplier

    def _generate_cloud_mask(self, h, w):
        noise = np.random.randn(h // 16, w // 16)
        mask = zoom(noise, 16, order=1)
        mask = (mask - mask.min()) / (mask.max() - mask.min() + 1e-6)
        return np.clip((mask - 0.25) / 0.75, 0.0, 1.0)[np.newaxis, :, :].astype(np.float32)

    def __getitem__(self, idx):
        file_path = self.file_list[idx % len(self.file_list)]
        data = np.load(file_path)['arr_0']

        clean_opt = data[0:4, :, :].copy()
        sar_radar = data[4:6, :, :].copy()

        if self.simulate_clouds:
            cloud_mask = self._generate_cloud_mask(clean_opt.shape[1], clean_opt.shape[2])
            cloudy_opt = clean_opt * (1.0 - cloud_mask) + 0.9 * cloud_mask
        else:
            cloudy_opt = clean_opt.copy()

        # Random horizontal and vertical flips
        if np.random.rand() > 0.5:
            clean_opt, cloudy_opt, sar_radar = [np.flip(x, axis=1) for x in (clean_opt, cloudy_opt, sar_radar)]
        if np.random.rand() > 0.5:
            clean_opt, cloudy_opt, sar_radar = [np.flip(x, axis=2) for x in (clean_opt, cloudy_opt, sar_radar)]

        return (
            torch.from_numpy(cloudy_opt.copy()),
            torch.from_numpy(sar_radar.copy()),
            torch.from_numpy(clean_opt.copy())
        )