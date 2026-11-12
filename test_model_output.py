import torch
import numpy as np
import matplotlib.pyplot as plt
from engine.api_server import _run_inference, _fetch_gee_data

bbox = [76.2600, 9.9200, 76.3000, 9.9600]
print("Fetching data...")
gee_data = _fetch_gee_data(bbox)
cloudy = gee_data["optical"]
sar = gee_data["sar"]
prior = gee_data["prior_optical"]

print("Running inference...")
raw = _run_inference(cloudy, sar, prior)

plt.imshow(np.clip(raw[:3].transpose(1, 2, 0), 0, 1) * 3.5)
plt.title("Model Raw Output")
plt.savefig("model_raw_output.png")
print("Saved model_raw_output.png")
