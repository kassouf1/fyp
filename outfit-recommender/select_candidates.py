"""
Pick a diverse set of Topwear/Bottomwear rows (men + women) from the local
styles.csv metadata, spreading picks across articleType and colour so the
catalog isn't 24 near-identical black t-shirts. Writes the chosen product
IDs (one per line, grouped by bucket) to candidates.txt for the download
step to consume.
"""
import csv
import random
from collections import defaultdict
from pathlib import Path

STYLES_CSV = Path(r"C:\Users\User\Desktop\fashion-dataset-small\styles.csv")
ITEMS_PER_BUCKET = 24
SEED = 42

SUBCATEGORY_TO_CATEGORY = {"Topwear": "top", "Bottomwear": "bottom"}
GENDER_MAP = {"Men": "men", "Women": "women"}

# Real wearable garments only — excludes accessories that share these
# subcategories in the raw data (Suspenders, Dupatta, Stockings/Tights,
# Swimwear) since those aren't "pants" or "shirts/tops" in any normal sense.
TOP_TYPES = {
    "Shirts", "Tshirts", "Tops", "Sweaters", "Sweatshirts", "Jackets",
    "Kurtas", "Kurtis", "Tunics", "Nehru Jackets", "Waistcoat",
}
BOTTOM_TYPES = {
    "Jeans", "Trousers", "Shorts", "Track Pants", "Tracksuits",
    "Leggings", "Capris", "Skirts", "Patiala", "Salwar and Dupatta",
    "Rain Trousers",
}
KIDS_MARKERS = ("kids", "girls", "boys", "infant", "toddler")


def main():
    random.seed(SEED)
    buckets = defaultdict(list)
    with open(STYLES_CSV, encoding="utf-8", errors="ignore") as f:
        for row in csv.DictReader(f):
            category = SUBCATEGORY_TO_CATEGORY.get(row.get("subCategory", ""))
            gender = GENDER_MAP.get(row.get("gender", ""))
            if not category or not gender:
                continue
            article_type = row.get("articleType", "")
            allowed = TOP_TYPES if category == "top" else BOTTOM_TYPES
            if article_type not in allowed:
                continue
            name = row.get("productDisplayName", "").lower()
            if any(marker in name for marker in KIDS_MARKERS):
                continue
            buckets[(gender, category)].append(row)

    chosen_lines = []
    for (gender, category), rows in sorted(buckets.items()):
        # Group by (articleType, baseColour) so we can round-robin across
        # combos instead of taking whatever happens to be first in the CSV.
        by_combo = defaultdict(list)
        for row in rows:
            key = (row.get("articleType", ""), row.get("baseColour", ""))
            by_combo[key].append(row)
        for v in by_combo.values():
            random.shuffle(v)
        combo_keys = list(by_combo.keys())
        random.shuffle(combo_keys)

        picked = []
        i = 0
        while len(picked) < ITEMS_PER_BUCKET and any(by_combo[k] for k in combo_keys):
            key = combo_keys[i % len(combo_keys)]
            if by_combo[key]:
                picked.append(by_combo[key].pop())
            i += 1

        print(f"{gender}/{category}: picked {len(picked)} (from {len(rows)} candidates, {len(combo_keys)} type/colour combos)")
        for row in picked:
            chosen_lines.append(f"{gender}\t{category}\t{row['id']}\t{row.get('articleType','')}\t{row.get('baseColour','')}\t{row.get('usage','')}\t{row.get('season','')}\t{row.get('productDisplayName','')}")

    out = Path(__file__).parent / "candidates.tsv"
    out.write_text("\n".join(chosen_lines), encoding="utf-8")
    print(f"\nWrote {len(chosen_lines)} candidates to {out}")


if __name__ == "__main__":
    main()
