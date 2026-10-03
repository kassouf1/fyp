import os
import requests

CATVTON_BASE = "http://127.0.0.1:8000"
CATVTON_URL = f"{CATVTON_BASE}/tryon"


def run_catvton(person_image_path, cloth_image_path, cloth_type="upper"):
    with open(person_image_path, "rb") as p, open(cloth_image_path, "rb") as c:
        files = {
            "person_image": p,
            "cloth_image": c,
        }

        data = {
            "cloth_type": cloth_type,
            # CatVTON's own demo defaults to 20 steps. A previous attempt at
            # 40 steps (to get a more converged/detailed result) assumed that
            # was safe given the 768x1024 generation resolution (see
            # CatVTON/api/main.py) — in practice, on an 8GB GPU already
            # sitting near its VRAM ceiling at that resolution, 40 steps
            # pushed real-world generation time past the client's request
            # timeout. Back to CatVTON's documented default; the resolution
            # bump (which is what actually fixed the blurry-result problem)
            # is kept.
            "num_inference_steps": "20",
            "guidance_scale": "2.5",
            "seed": "42",
        }

        response = requests.post(CATVTON_URL, files=files, data=data)
        response.raise_for_status()

        return response.json()


def download_result(result_url, dest_dir="uploads"):
    """Pull a CatVTON result image back down to a local file so it can be fed
    back in as the person image for a second try-on pass — used for "top +
    bottom" mode, which is really two chained single-garment passes since
    CatVTON only masks one body region (upper/lower/overall) per call.
    """
    os.makedirs(dest_dir, exist_ok=True)
    filename = os.path.basename(result_url)
    dest_path = os.path.join(dest_dir, f"chain_{filename}")
    resp = requests.get(f"{CATVTON_BASE}{result_url}")
    resp.raise_for_status()
    with open(dest_path, "wb") as f:
        f.write(resp.content)
    return dest_path
