import torch
import torch.nn as nn
import torch.nn.functional as F

# =====================================================================
# 1. Temporal 10-Channel U-Net (Matches Kaggle auraclear_weights.pth)
# =====================================================================
class CloudCleanserUNet(nn.Module):
    def __init__(self, in_channels=10, out_channels=4):
        super(CloudCleanserUNet, self).__init__()
        
        # Encoder (Downsampling)
        self.enc1 = self.conv_block(in_channels, 64)
        self.enc2 = self.conv_block(64, 128)
        self.pool = nn.MaxPool2d(2)
        
        # Bottleneck
        self.bottleneck = self.conv_block(128, 256)
        
        # Decoder (Upsampling)
        self.up1 = nn.ConvTranspose2d(256, 128, kernel_size=2, stride=2)
        self.dec1 = self.conv_block(256, 128) 
        
        self.up2 = nn.ConvTranspose2d(128, 64, kernel_size=2, stride=2)
        self.dec2 = self.conv_block(128, 64)
        
        # Final Output Layer
        self.final = nn.Conv2d(64, out_channels, kernel_size=1)
        self.sigmoid = nn.Sigmoid() 

    def conv_block(self, in_c, out_c):
        return nn.Sequential(
            nn.Conv2d(in_c, out_c, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_c, out_c, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True)
        )

    def forward(self, x):
        # Encoder
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        
        # Bottleneck
        b = self.bottleneck(self.pool(e2))
        
        # Decoder with Skip Connections
        d1 = self.up1(b)
        d1 = torch.cat([d1, e2], dim=1)
        d1 = self.dec1(d1)
        
        d2 = self.up2(d1)
        d2 = torch.cat([d2, e1], dim=1)
        d2 = self.dec2(d2)
        
        return self.sigmoid(self.final(d2))


# =====================================================================
# 2. Dual-Stream Cross-Attention Architecture & Losses
# =====================================================================
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


class EfficientCrossAttention(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.channels = channels
        self.pool = nn.AdaptiveAvgPool2d((16, 16))
        self.q = nn.Conv2d(channels, channels // 4, kernel_size=1)
        self.k = nn.Conv2d(channels, channels // 4, kernel_size=1)
        self.v = nn.Conv2d(channels, channels, kernel_size=1)
        self.proj = nn.Conv2d(channels, channels, kernel_size=1)

    def forward(self, opt_feat, sar_feat):
        B, C, H, W = opt_feat.shape
        opt_pooled = self.pool(opt_feat)
        sar_pooled = self.pool(sar_feat)
        
        q = self.q(opt_pooled).flatten(2).transpose(1, 2)
        k = self.k(sar_pooled).flatten(2)
        v = self.v(sar_pooled).flatten(2).transpose(1, 2)

        attn = F.softmax(torch.bmm(q, k) / ((C // 4) ** 0.5), dim=-1)
        out = torch.bmm(attn, v).transpose(1, 2).view(B, C, 16, 16)
        out = F.interpolate(out, size=(H, W), mode='bilinear', align_corners=False)
        return self.proj(out) + opt_feat


class SAROpticalCloudCleanser(nn.Module):
    def __init__(self):
        super().__init__()
        self.opt_enc1 = ConvBlock(4, 32)
        self.opt_enc2 = ConvBlock(32, 64)
        
        self.sar_enc1 = ConvBlock(2, 32)
        self.sar_enc2 = ConvBlock(32, 64)

        self.cross_attn = EfficientCrossAttention(64)

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
        
    def forward(self, pred, target, eps=1e-7):
        l1_loss = self.l1(pred, target)
        dot = torch.sum(pred * target, dim=1)
        norm_p = torch.clamp(torch.norm(pred, dim=1), min=eps)
        norm_t = torch.clamp(torch.norm(target, dim=1), min=eps)
        cos_theta = torch.clamp(dot / (norm_p * norm_t), -1.0 + eps, 1.0 - eps)
        sam_loss = torch.mean(torch.acos(cos_theta))
        return l1_loss + 0.15 * sam_loss