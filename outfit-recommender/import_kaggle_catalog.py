"""
One-off script to populate catalog.json from the Kaggle "Fashion Product
Images Dataset" (paramaggarwal). Download and extract that dataset, then run:

    venv\\Scripts\\python.exe import_kaggle_catalog.py "C:\\path\\to\\extracted\\dataset"

Expects the dataset's usual layout: a styles.csv and an images/ folder with
files named "<id>.jpg" inside the given root folder (searched recursively).
"""
import csv
import json
import shutil
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent / "app"
ASSETS_DIR = APP_DIR / "assets" / "garments"
CATALOG_PATH = APP_DIR / "catalog.json"

ITEMS_PER_BUCKET = 15  # per (gender, category) combination

# Kaggle subCategory -> our catalog category + garment folder + CatVTON cloth_type
SUBCATEGORY_MAP = {
    "Topwear":    {"category": "top",    "cloth_type": "upper"},
    "Bottomwear": {"category": "bottom", "cloth_type": "lower"},
    "Shoes":      {"category": "shoes",  "cloth_type": None},  # not try-on-able
}

GENDER_MAP = {"Men": "men", "Women": "women"}

USAGE_TO_STYLE = {
    "Casual": "casual", "Smart Casual": "minimal", "Formal": "elegant",
    "Party": "elegant", "Sports": "streetwear", "Ethnic": "elegant",
    "Travel": "casual", "Home": "casual",
}
SEASON_MAP = {"Summer": "summer", "Winter": "winter", "Spring": "spring", "Fall": "autumn"}


def find_file(root: Path, filename: str) -> Path | None:
    matches = list(root.rglob(filename))
    return matches[0] if matches else None


def main():
    if len(sys.argv) < 2:
        print("Usage: python import_kaggle_catalog.py <path to extracted dataset>")
        sys.exit(1)

    dataset_root = Path(sys.argv[1])
    styles_csv = find_file(dataset_root, "styles.csv")
    if not styles_csv:
        print(f"Could not find styles.csv under {dataset_root}")
        sys.exit(1)

    images_dir = styles_csv.parent / "images"
    if not images_dir.exists():
        found = find_file(dataset_root, "images")
        if found is None:
            print("Could not find an images/ folder near styles.csv")
            sys.exit(1)
        images_dir = found

    print(f"Using styles.csv: {styles_csv}")
    print(f"Using images dir: {images_dir}")

    # bucket key: (gender_folder, category) -> list of csv rows
    buckets: dict[tuple[str, str], list[dict]] = {}

    with open(styles_csv, encoding="utf-8", errors="ignore") as f:
        for row in csv.DictReader(f):
            sub = SUBCATEGORY_MAP.get(row.get("subCategory", ""))
            gender = GENDER_MAP.get(row.get("gender", ""))
            if not sub or not gender:
                continue
            key = (gender, sub["category"])
            buckets.setdefault(key, []).append(row)

    catalog = []
    next_id = 1

    for (gender, category), rows in sorted(buckets.items()):
        folder_name = {"top": "tops", "bottom": "bottoms", "shoes": "shoes"}[category]
        dest_dir = ASSETS_DIR / gender / folder_name
        dest_dir.mkdir(parents=True, exist_ok=True)

        picked = 0
        for row in rows:
            if picked >= ITEMS_PER_BUCKET:
                break

            product_id = row["id"]
            src_image = images_dir / f"{product_id}.jpg"
            if not src_image.exists():
                continue

            dest_image = dest_dir / f"{product_id}.jpg"
            shutil.copyfile(src_image, dest_image)

            style_tag = USAGE_TO_STYLE.get(row.get("usage", ""), "casual")
            season = SEASON_MAP.get(row.get("season", ""), "all")
            cloth_type = SUBCATEGORY_MAP[row["subCategory"]]["cloth_type"]

            catalog.append({
                "id": str(next_id),
                "brand": "Kaggle",
                "title": row.get("productDisplayName", f"{category} item {product_id}")[:60],
                "gender": gender,
                "category": category,
                "cloth_type": cloth_type,
                "color": row.get("baseColour", "").lower() or "multi",
                "season": season,
                "style": [style_tag],
                "price": 0,
                "image_url": f"assets/garments/{gender}/{folder_name}/{product_id}.jpg",
            })
            next_id += 1
            picked += 1

        print(f"{gender}/{category}: added {picked} items")

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)

    print(f"\nWrote {len(catalog)} items to {CATALOG_PATH}")


if __name__ == "__main__":
    main()
