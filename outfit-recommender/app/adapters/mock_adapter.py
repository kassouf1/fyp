import json
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent.parent

# The Kaggle source data's "season" tag is unreliable on its own — e.g. a
# wind cheater jacket and a waistcoat both show up tagged season "summer".
# Layered/insulating garments get flagged "heavy" here from their title so
# the matcher can hard-exclude them from hot-weather recommendations
# regardless of what the season tag says.
HEAVY_GARMENT_KEYWORDS = [
    "jacket", "sweater", "sweatshirt", "hoodie", "coat", "blazer",
    "waistcoat", "cardigan", "wind cheater", "windcheater", "fleece",
    "parka", "thermal",
]


def classify_warmth(title):
    lowered = title.lower()
    if any(keyword in lowered for keyword in HEAVY_GARMENT_KEYWORDS):
        return "heavy"
    return "light"


def normalize_product(raw_product):
    return {
        "id": str(raw_product["id"]),
        "brand": raw_product["brand"],
        "title": raw_product["title"],
        "gender": raw_product["gender"],
        "category": raw_product["category"],
        "color": raw_product["color"],
        "season": raw_product["season"],
        "style": raw_product["style"],
        "warmth": classify_warmth(raw_product["title"]),
        "price": float(raw_product["price"]),
        # catalog.json stores paths relative to app/ so this keeps working
        # regardless of where the project folder is on disk. image_url is an
        # absolute local path (what run_catvton needs to open the file);
        # image_path is the same file served over HTTP for the app to show.
        "image_url": str(APP_DIR / raw_product["image_url"]),
        "image_path": f"/{raw_product['image_url']}",
    }


def get_products():
    catalog_path = Path(__file__).resolve().parent.parent / "catalog.json"

    with open(catalog_path, "r", encoding="utf-8") as file:
        raw_products = json.load(file)

    normalized_products = [normalize_product(product) for product in raw_products]

    # Shoes aren't try-on-able (CatVTON only masks upper/lower body regions),
    # so they're filtered out at the source here rather than in every
    # consumer (Brand Shop's /catalog, the recommender, similarity search).
    return [p for p in normalized_products if p["category"] != "shoes"]