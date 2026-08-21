"""
Download full-resolution images for the IDs picked by select_candidates.py,
via the Kaggle API's per-file download (avoids pulling the whole 24GB
dataset). Saves straight into the app's garment asset folders.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
CANDIDATES = ROOT / "candidates.tsv"
ASSETS_DIR = ROOT / "app" / "assets" / "garments"
DATASET = "paramaggarwal/fashion-product-images-dataset"
REMOTE_PREFIX = "fashion-dataset/fashion-dataset/images"
FOLDER_NAME = {"top": "tops", "bottom": "bottoms"}


def main():
    lines = [l for l in CANDIDATES.read_text(encoding="utf-8").splitlines() if l.strip()]
    total = len(lines)
    ok, failed = 0, []

    for i, line in enumerate(lines, 1):
        gender, category, product_id = line.split("\t")[:3]
        dest_dir = ASSETS_DIR / gender / FOLDER_NAME[category]
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_file = dest_dir / f"{product_id}.jpg"

        if dest_file.exists() and dest_file.stat().st_size > 0:
            print(f"[{i}/{total}] {gender}/{category}/{product_id}.jpg — already present, skipping")
            ok += 1
            continue

        remote_path = f"{REMOTE_PREFIX}/{product_id}.jpg"
        result = subprocess.run(
            [sys.executable, "-m", "kaggle", "datasets", "download",
             "-d", DATASET, "-f", remote_path, "-p", str(dest_dir), "--force"],
            capture_output=True, text=True,
        )
        downloaded = dest_dir / f"{product_id}.jpg"
        if downloaded.exists() and downloaded.stat().st_size > 0:
            print(f"[{i}/{total}] {gender}/{category}/{product_id}.jpg — OK ({downloaded.stat().st_size} bytes)")
            ok += 1
        else:
            print(f"[{i}/{total}] {gender}/{category}/{product_id}.jpg — FAILED: {result.stderr.strip()[:200]}")
            failed.append(line)

    print(f"\n{ok}/{total} downloaded successfully.")
    if failed:
        print(f"{len(failed)} failed:")
        for f in failed:
            print(" ", f)
        (ROOT / "failed_candidates.tsv").write_text("\n".join(failed), encoding="utf-8")


if __name__ == "__main__":
    main()
