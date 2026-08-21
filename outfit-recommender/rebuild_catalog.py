"""
Rebuild catalog.json's top/bottom entries from the newly-downloaded
full-resolution images picked by select_candidates.py, while leaving the
existing shoes entries untouched. Also deletes the old low-res top/bottom
thumbnails that are no longer referenced.
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent
APP_DIR = ROOT / "app"
ASSETS_DIR = APP_DIR / "assets" / "garments"
CATALOG_PATH = APP_DIR / "catalog.json"
CANDIDATES = ROOT / "candidates.tsv"

FOLDER_NAME = {"top": "tops", "bottom": "bottoms"}
CLOTH_TYPE = {"top": "upper", "bottom": "lower"}

USAGE_TO_STYLE = {
    "Casual": "casual", "Smart Casual": "minimal", "Formal": "elegant",
    "Party": "elegant", "Sports": "streetwear", "Ethnic": "elegant",
    "Travel": "casual", "Home": "casual",
}
SEASON_MAP = {"Summer": "summer", "Winter": "winter", "Spring": "spring", "Fall": "autumn"}


def main():
    with open(CATALOG_PATH, encoding="utf-8") as f:
        catalog = json.load(f)

    kept = [item for item in catalog if item["category"] == "shoes"]
    next_id = max((int(i["id"]) for i in catalog), default=0) + 1

    # Which files are about to become the new top/bottom set, per folder —
    # anything else currently in those folders is an old thumbnail to remove.
    lines = [l for l in CANDIDATES.read_text(encoding="utf-8").splitlines() if l.strip()]
    keep_files = {}  # (gender, folder) -> set of filenames
    new_items = []

    for line in lines:
        parts = line.split("\t")
        gender, category, product_id, article_type, colour, usage, season, name = parts
        folder = FOLDER_NAME[category]
        dest_dir = ASSETS_DIR / gender / folder
        image_path = dest_dir / f"{product_id}.jpg"
        keep_files.setdefault((gender, folder), set()).add(image_path.name)

        if not image_path.exists() or image_path.stat().st_size == 0:
            print(f"skip {gender}/{folder}/{product_id}.jpg — not downloaded")
            continue

        new_items.append({
            "id": str(next_id),
            "brand": "Kaggle",
            "title": (name or f"{category} item {product_id}")[:60],
            "gender": gender,
            "category": category,
            "cloth_type": CLOTH_TYPE[category],
            "color": colour.lower() or "multi",
            "season": SEASON_MAP.get(season, "all"),
            "style": [USAGE_TO_STYLE.get(usage, "casual")],
            "price": 0,
            "image_url": f"assets/garments/{gender}/{folder}/{product_id}.jpg",
        })
        next_id += 1

    # Clean up old thumbnails no longer referenced by the catalog.
    removed = 0
    for gender in ("men", "women"):
        for folder in ("tops", "bottoms"):
            d = ASSETS_DIR / gender / folder
            if not d.exists():
                continue
            keep = keep_files.get((gender, folder), set())
            for f in d.iterdir():
                if f.is_file() and f.name not in keep:
                    f.unlink()
                    removed += 1
    print(f"Removed {removed} old thumbnail(s).")

    final_catalog = kept + new_items
    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(final_catalog, f, indent=2)

    print(f"Wrote {len(final_catalog)} items to {CATALOG_PATH} "
          f"({len(kept)} unchanged shoes + {len(new_items)} new tops/bottoms).")


if __name__ == "__main__":
    main()
