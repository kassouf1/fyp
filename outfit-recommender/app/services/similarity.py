import json
import math
import os
from typing import Optional

import requests

from app.adapters.mock_adapter import get_products, APP_DIR

# CatVTON already has torch/transformers/GPU loaded for the diffusion
# pipeline, so image embedding lives there rather than pulling those heavy
# dependencies into this otherwise lightweight service — this just calls
# out to it, the same way catvton_client.py already does for try-on.
CATVTON_EMBED_URL = "http://127.0.0.1:8000/embed-image"

_EMBED_CACHE_PATH = APP_DIR / "catalog_embeddings.json"

_catalog_embeddings: Optional[dict] = None  # {product_id: [floats]}


def _embed_image_bytes(image_bytes: bytes, filename: str = "image.jpg") -> list:
    files = {"image": (filename, image_bytes)}
    response = requests.post(CATVTON_EMBED_URL, files=files, timeout=60)
    response.raise_for_status()
    return response.json()["embedding"]


def _cosine_similarity(a: list, b: list) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _build_catalog_embeddings() -> dict:
    embeddings = {}
    for product in get_products():
        try:
            with open(product["image_url"], "rb") as f:
                image_bytes = f.read()
            embeddings[product["id"]] = _embed_image_bytes(
                image_bytes, filename=os.path.basename(product["image_url"])
            )
        except Exception as e:
            print(f"Skipping embedding for product {product['id']}: {e}")

    with open(_EMBED_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(embeddings, f)

    return embeddings


def _get_catalog_embeddings() -> dict:
    global _catalog_embeddings
    if _catalog_embeddings is not None:
        return _catalog_embeddings

    if _EMBED_CACHE_PATH.exists():
        with open(_EMBED_CACHE_PATH, "r", encoding="utf-8") as f:
            _catalog_embeddings = json.load(f)
        # Catalog was rebuilt (new/renamed ids) since the cache was written —
        # regenerate rather than silently missing the new items forever.
        catalog_ids = {p["id"] for p in get_products()}
        if not catalog_ids.issubset(_catalog_embeddings.keys()):
            _catalog_embeddings = _build_catalog_embeddings()
    else:
        _catalog_embeddings = _build_catalog_embeddings()

    return _catalog_embeddings


def find_similar_garments(
    image_bytes: bytes,
    category: Optional[str] = None,
    gender: Optional[str] = None,
    top_k: int = 5,
) -> list:
    catalog_embeddings = _get_catalog_embeddings()
    if not catalog_embeddings:
        return []

    query_embedding = _embed_image_bytes(image_bytes)

    products_by_id = {p["id"]: p for p in get_products()}
    scored = []
    for product_id, embedding in catalog_embeddings.items():
        product = products_by_id.get(product_id)
        if not product:
            continue
        if category and product["category"] != category:
            continue
        if gender and product["gender"] != gender:
            continue
        scored.append((_cosine_similarity(query_embedding, embedding), product))

    scored.sort(reverse=True, key=lambda x: x[0])
    return [
        {**product, "similarity": round(score, 4)}
        for score, product in scored[:top_k]
    ]
