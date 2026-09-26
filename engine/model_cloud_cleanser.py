import torch
import torch.nn as nn
import torch.nn.functional as F

class ConvBlock(nn.Module):
    def __init__(self, in_c, out_c):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_c, out_c, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_c),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(out_c, out_c, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_c),
            nn.LeakyReLU(0.2, inplace=True)
        )
    def forward(self, x):
        return self.conv(x)

class CrossAttentionFusion(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.q = nn.Conv2d(channels, channels // 4, kernel_size=1)
        self.k = nn.Conv2d(channels, channels // 4, kernel_size=1)
        self.v = nn.Conv2d(channels, channels, kernel_size=1)
        self.proj = nn.Conv2d(channels, channels, kernel_size=1)

    def forward(self, opt_feat, sar_feat):
        B, C, H, W = opt_feat.shape
        Q = self.q(opt_feat).view(B, -1, H * W).permute(0, 2, 1)
        K = self.k(sar_feat).view(B, -1, H * W)
        V = self.v(sar_feat).view(B, -1, H * W).permute(0, 2, 1)

        attn = F.softmax(torch.bmm(Q, K) / ((C // 4) ** 0.5), dim=-1)
        out = torch.bmm(attn, V).permute(0, 2, 1).view(B, C, H, W)
        return self.proj(out) + opt_feat

class SAROpticalCloudCleanser(nn.Module):
    def __init__(self):
        super().__init__()
        self.opt_enc1 = ConvBlock(4, 32)
        self.opt_enc2 = ConvBlock(32, 64)
        
        self.sar_enc1 = ConvBlock(2, 32)
        self.sar_enc2 = ConvBlock(32, 64)

        self.cross_attn = CrossAttentionFusion(64)

        self.up = nn.Upsample(scale_factor=2, mode='bilinear', align_corners=False)
        self.dec2 = ConvBlock(64 + 32, 32)
        self.dec_out = nn.Sequential(
            nn.Conv2d(32, 4, kernel_size=3, padding=1),
            nn.Sigmoid()
        )

    def forward(self, opt_cloudy, sar_radar):
        o1 = self.opt_enc1(opt_cloudy)
        o2 = self.opt_enc2(F.max_pool2d(o1, 2))

        s1 = self.sar_enc1(sar_radar)
        s2 = self.sar_enc2(F.max_pool2d(s1, 2))

        bottleneck = self.cross_attn(o2, s2)

        d1 = self.up(bottleneck)
        d1 = torch.cat([d1, o1], dim=1)
        d2 = self.dec2(d1)
        return self.dec_out(d2)

class CloudCleanserLoss(nn.Module):
    def __init__(self):
        super().__init__()
        self.l1 = nn.L1Loss()
        
    def forward(self, pred, target, eps=1e-8):
        l1_loss = self.l1(pred, target)
        
        # Spectral Angle Mapper (SAM) Loss
        dot = torch.sum(pred * target, dim=1)
        norm_p = torch.norm(pred, dim=1)
        norm_t = torch.norm(target, dim=1)
        cos_theta = torch.clamp(dot / (norm_p * norm_t + eps), -1.0 + eps, 1.0 - eps)
        sam_loss = torch.mean(torch.acos(cos_theta))

        return l1_loss + 0.15 * sam_loss