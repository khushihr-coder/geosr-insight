import torch
import torch.nn as nn
import torch.nn.functional as F
from math import exp
from torchvision.models import vgg16, VGG16_Weights

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


# =====================================================================
# Loss Functions for Training
# =====================================================================

def gaussian(window_size, sigma):
    gauss = torch.Tensor([exp(-(x - window_size // 2) ** 2 / float(2 * sigma ** 2)) for x in range(window_size)])
    return gauss / gauss.sum()

def create_window(window_size, channel):
    _1D_window = gaussian(window_size, 1.5).unsqueeze(1)
    _2D_window = _1D_window.mm(_1D_window.t()).float().unsqueeze(0).unsqueeze(0)
    window = _2D_window.expand(channel, 1, window_size, window_size).contiguous()
    return window

def _ssim(img1, img2, window, window_size, channel, size_average=True):
    mu1 = F.conv2d(img1, window, padding=window_size // 2, groups=channel)
    mu2 = F.conv2d(img2, window, padding=window_size // 2, groups=channel)
    mu1_sq = mu1.pow(2)
    mu2_sq = mu2.pow(2)
    mu1_mu2 = mu1 * mu2
    sigma1_sq = F.conv2d(img1 * img1, window, padding=window_size // 2, groups=channel) - mu1_sq
    sigma2_sq = F.conv2d(img2 * img2, window, padding=window_size // 2, groups=channel) - mu2_sq
    sigma12 = F.conv2d(img1 * img2, window, padding=window_size // 2, groups=channel) - mu1_mu2
    C1 = 0.01 ** 2
    C2 = 0.03 ** 2
    ssim_map = ((2 * mu1_mu2 + C1) * (2 * sigma12 + C2)) / ((mu1_sq + mu2_sq + C1) * (sigma1_sq + sigma2_sq + C2))
    if size_average:
        return ssim_map.mean()
    else:
        return ssim_map.mean(1).mean(1).mean(1)

class SSIMLoss(nn.Module):
    def __init__(self, window_size=11, size_average=True):
        super(SSIMLoss, self).__init__()
        self.window_size = window_size
        self.size_average = size_average
        self.channel = 1
        self.window = create_window(window_size, self.channel)

    def forward(self, img1, img2):
        (_, channel, _, _) = img1.size()
        if channel == self.channel and self.window.data.type() == img1.data.type():
            window = self.window
        else:
            window = create_window(self.window_size, channel)
            if img1.is_cuda:
                window = window.cuda(img1.get_device())
            window = window.type_as(img1)
            self.window = window
            self.channel = channel
        return 1 - _ssim(img1, img2, window, self.window_size, channel, self.size_average)


class SatellitePerceptualLoss(nn.Module):
    def __init__(self, device='cuda'):
        super().__init__()
        # Extract features from early & mid VGG layers for texture fidelity
        vgg = vgg16(weights=VGG16_Weights.DEFAULT).features.to(device).eval()
        self.slice1 = nn.Sequential(*[vgg[x] for x in range(4)]).eval()   # Relu1_2 (fine textures)
        self.slice2 = nn.Sequential(*[vgg[x] for x in range(4, 9)]).eval() # Relu2_2 (edges)
        for param in self.parameters():
            param.requires_grad = False

    def forward(self, pred_rgb, target_rgb):
        # RGB slices normalized to ImageNet stats
        # We only pass the first 3 channels (RGB) to VGG, excluding NIR
        pred_rgb_3 = pred_rgb[:, :3, :, :]
        target_rgb_3 = target_rgb[:, :3, :, :]
        
        p_feat1 = self.slice1(pred_rgb_3)
        t_feat1 = self.slice1(target_rgb_3)
        p_feat2 = self.slice2(p_feat1)
        t_feat2 = self.slice2(t_feat1)
        return F.l1_loss(p_feat1, t_feat1) + F.l1_loss(p_feat2, t_feat2)

def spectral_angle_loss(pred, target):
    """Enforces identical spectral signature vector directions across channels"""
    pred_norm = F.normalize(pred, p=2, dim=1, eps=1e-8)
    target_norm = F.normalize(target, p=2, dim=1, eps=1e-8)
    cosine_sim = torch.sum(pred_norm * target_norm, dim=1)
    return torch.mean(1.0 - cosine_sim)


class CloudCleanserLoss(nn.Module):
    def __init__(self, device='cuda'):
        super().__init__()
        self.smooth_l1 = nn.SmoothL1Loss(reduction='none') # Change to none to apply mask weighting later
        self.ssim = SSIMLoss()
        self.vgg_perc = SatellitePerceptualLoss(device=device)
        
    def forward(self, pred, target, cloud_mask=None):
        """
        L_total = L_SmoothL1 + 0.5 * L_SSIM + 0.1 * L_VGGPerc + 0.05 * L_Spectral
        cloud_mask: Optional binary mask (1 for cloud, 0 for clear ground) to apply attention weighting.
        """
        # 1. Pixel-wise Loss (Mask Weighted if mask provided)
        base_l1 = self.smooth_l1(pred, target)
        if cloud_mask is not None:
            # Mask-Weighted Loss Attention (Focus Gradients on Clouds)
            # Multiply loss by 4.0 over the cloud-occluded zones
            weight_map = 1.0 + 3.0 * cloud_mask 
            base_l1 = base_l1 * weight_map
        l1_loss = base_l1.mean()
        
        # 2. Structural Similarity Loss
        ssim_loss = self.ssim(pred, target)
        
        # 3. Perceptual Texture Loss
        perc_loss = self.vgg_perc(pred, target)
        
        # 4. Spectral Angle Loss
        spectral_loss = spectral_angle_loss(pred, target)
        
        return l1_loss + 0.5 * ssim_loss + 0.1 * perc_loss + 0.05 * spectral_loss