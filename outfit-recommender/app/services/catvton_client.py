import os  # used to build file paths and create the uploads directory
import requests  # HTTP client used to call the separate CatVTON FastAPI service

CATVTON_BASE = "http://127.0.0.1:8000"  # base URL of the CatVTON service (runs as its own process on port 8000)
CATVTON_URL = f"{CATVTON_BASE}/tryon"  # full URL of CatVTON's try-on generation endpoint


def run_catvton(person_image_path, cloth_image_path, cloth_type="upper"):  # sends one person+garment photo pair to CatVTON and returns its JSON result
    with open(person_image_path, "rb") as p, open(cloth_image_path, "rb") as c:  # open both image files in binary mode for upload
        files = {  # multipart file fields expected by CatVTON's /tryon endpoint
            "person_image": p,
            "cloth_image": c,
        }

        data = {  # the non-file form fields CatVTON needs
            "cloth_type": cloth_type,  # "upper" or "lower" — tells CatVTON which body region to mask
            # CatVTON's own demo defaults to 20 steps. A previous attempt at
            # 40 steps (to get a more converged/detailed result) assumed that
            # was safe given the 768x1024 generation resolution (see
            # CatVTON/api/main.py) — in practice, on an 8GB GPU already
            # sitting near its VRAM ceiling at that resolution, 40 steps
            # pushed real-world generation time past the client's request
            # timeout. Back to CatVTON's documented default; the resolution
            # bump (which is what actually fixed the blurry-result problem)
            # is kept.
            "num_inference_steps": "20",  # number of diffusion denoising steps — more steps = slower but can look more refined
            "guidance_scale": "2.5",  # how strongly the model follows the conditioning (garment) image
            "seed": "42",  # fixed random seed so results are reproducible between runs
        }

        response = requests.post(CATVTON_URL, files=files, data=data)  # actually send the HTTP request to CatVTON
        response.raise_for_status()  # raise an exception if CatVTON returned an error status code

        return response.json()  # parse and return CatVTON's JSON response (includes the result image URL)


def download_result(result_url, dest_dir="uploads"):  # downloads a CatVTON result image back to local disk
    """Pull a CatVTON result image back down to a local file so it can be fed
    back in as the person image for a second try-on pass — used for "top +
    bottom" mode, which is really two chained single-garment passes since
    CatVTON only masks one body region (upper/lower/overall) per call.
    """
    os.makedirs(dest_dir, exist_ok=True)  # make sure the destination folder exists
    filename = os.path.basename(result_url)  # extract just the filename portion from the URL
    dest_path = os.path.join(dest_dir, f"chain_{filename}")  # prefix with "chain_" so it's clear this is an intermediate chained result
    resp = requests.get(f"{CATVTON_BASE}{result_url}")  # download the actual image bytes from CatVTON
    resp.raise_for_status()  # raise an exception if the download failed
    with open(dest_path, "wb") as f:  # open the local destination file for binary writing
        f.write(resp.content)  # write the downloaded image bytes to disk
    return dest_path  # return the local path so the caller can re-upload it as the next "person image"
