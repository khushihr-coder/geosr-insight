import torch
import torch.nn as nn
import torch.nn.functional as F

class SubPixelUpsampleBlock(nn.Module):
    """
    PixelShuffle module to upscale 10m features to sub-4m (~2.5m - 3.5m resolution).
    """
    def __init__(self, in_channels, out_channels, scale_factor=3):
        super().__init__()
        self.conv = nn.Conv2d(in_channels, out_channels * (scale_factor ** 2), kernel_size=3, padding=1)
        self.pixel_shuffle = nn.PixelShuffle(scale_factor)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        return self.relu(self.pixel_shuffle(self.conv(x)))

class SuperResolutionCleanser(nn.Module):
    """
    10-Channel Input (Cloudy Optical + SAR + Prior) -> 4-Channel Sub-4m Super-Resolved Output
    """
    def __init__(self, in_channels=10, out_channels=4):
        super().__init__()
        self.enc1 = nn.Sequential(
            nn.Conv2d(in_channels, 64, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, 3, padding=1),
            nn.ReLU(inplace=True)
        )
        self.pool1 = nn.MaxPool2d(2)
        
        self.enc2 = nn.Sequential(
            nn.Conv2d(64, 128, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, 3, padding=1),
            nn.ReLU(inplace=True)
        )
        self.pool2 = nn.MaxPool2d(2)

        self.bottleneck = nn.Sequential(
            nn.Conv2d(128, 256, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, 3, padding=1),
            nn.ReLU(inplace=True)
        )

        self.up1 = nn.ConvTranspose2d(256, 128, 2, stride=2)
        self.dec1 = nn.Sequential(
            nn.Conv2d(256, 128, 3, padding=1),
            nn.ReLU(inplace=True)
        )  # Properly closed parenthesis here

        # 3x scale factor to transition from 10m to ~3.3m resolution
        self.super_res_upsample = SubPixelUpsampleBlock(128, 64, scale_factor=3)
        
        self.final_conv = nn.Sequential(
            nn.Conv2d(64, out_channels, 3, padding=1),
            nn.Sigmoid()
        )

    def forward(self, x):
        e1 = self.enc1(x)
        p1 = self.pool1(e1)
        
        e2 = self.enc2(p1)
        p2 = self.pool2(e2)

        b = self.bottleneck(p2)

        u1 = self.up1(b)
        if u1.shape != e2.shape:
            u1 = F.interpolate(u1, size=e2.shape[2:])
        d1 = torch.cat([u1, e2], dim=1)
        d1 = self.dec1(d1)

        sr = self.super_res_upsample(d1)
        
        if sr.shape[2:] != (x.shape[2] * 3, x.shape[3] * 3):
            sr = F.interpolate(sr, size=(x.shape[2] * 3, x.shape[3] * 3), mode='bilinear', align_corners=False)

        return self.final_conv(sr)