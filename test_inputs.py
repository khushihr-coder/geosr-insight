import numpy as np
import matplotlib.pyplot as plt
from engine.api_server import _fetch_gee_data

bbox = [76.2600, 9.9200, 76.3000, 9.9600]
print("Fetching data...")
gee_data = _fetch_gee_data(bbox)
cloudy = gee_data["optical"]
sar = gee_data["sar"]
prior = gee_data["prior_optical"]

fig, axs = plt.subplots(1, 3, figsize=(15, 5))
axs[0].imshow(np.clip(cloudy[:3].transpose(1, 2, 0) * 3.5, 0, 1))
axs[0].set_title("Cloudy")
axs[1].imshow(np.clip(sar[0], 0, 1), cmap='gray')
axs[1].set_title("SAR VV")
axs[2].imshow(np.clip(prior[:3].transpose(1, 2, 0) * 3.5, 0, 1))
axs[2].set_title("Prior Optical")
plt.savefig("input_tensors.png")
print("Saved input_tensors.png")
