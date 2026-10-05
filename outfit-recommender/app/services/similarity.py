import json  # read/write the cached catalog embeddings file
import math  # sqrt, used in the cosine similarity formula
import os  # path helpers
from typing import Optional  # marks optional filter parameters

import requests  # HTTP client used to call CatVTON's embedding endpoint

from app.adapters.mock_adapter import get_products, APP_DIR  # catalog loader + this app's root folder

# CatVTON already has torch/transformers/GPU loaded for the diffusion
# pipeline, so image embedding lives there rather than pulling those heavy
# dependencies into this otherwise lightweight service — this just calls
# out to it, the same way catvton_client.py already does for try-on.
CATVTON_EMBED_URL = "http://127.0.0.1:8000/embed-image"  # CatVTON's CLIP embedding endpoint (runs in the OTHER service, not here)

_EMBED_CACHE_PATH = APP_DIR / "catalog_embeddings.json"  # on-disk cache so we don't re-embed the whole catalog on every restart

_catalog_embeddings: Optional[dict] = None  # {product_id: [floats]}  # in-memory cache, lazily filled on first use


def _embed_image_bytes(image_bytes: bytes, filename: str = "image.jpg") -> list:  # turns raw image bytes into a CLIP embedding vector
    files = {"image": (filename, image_bytes)}  # multipart file payload expected by CatVTON's endpoint
    response = requests.post(CATVTON_EMBED_URL, files=files, timeout=60)  # call out to CatVTON to compute the embedding
    response.raise_for_status()  # raise if CatVTON returned an error
    return response.json()["embedding"]  # the embedding is a plain list of floats


def _cosine_similarity(a: list, b: list) -> float:  # measures how "similar in direction" two embedding vectors are (1 = identical, 0 = unrelated)
    dot = sum(x * y for x, y in zip(a, b))  # dot product of the two vectors
    norm_a = math.sqrt(sum(x * x for x in a))  # length (magnitude) of vector a
    norm_b = math.sqrt(sum(y * y for y in b))  # length (magnitude) of vector b
    if norm_a == 0 or norm_b == 0:  # guard against dividing by zero for a degenerate all-zero vector
        return 0.0
    return dot / (norm_a * norm_b)  # cosine similarity formula: dot product divided by the product of the lengths


def _build_catalog_embeddings() -> dict:  # computes (and caches to disk) a CLIP embedding for every catalog product image
    embeddings = {}  # product_id -> embedding vector
    for product in get_products():  # go through every item in the catalog
        try:
            with open(product["image_url"], "rb") as f:  # open that product's local image file
                image_bytes = f.read()
            embeddings[product["id"]] = _embed_image_bytes(  # embed it via CatVTON and store the result
                image_bytes, filename=os.path.basename(product["image_url"])
            )
        except Exception as e:  # a missing/corrupt image shouldn't break the whole catalog build
            print(f"Skipping embedding for product {product['id']}: {e}")

    with open(_EMBED_CACHE_PATH, "w", encoding="utf-8") as f:  # persist all computed embeddings to disk
        json.dump(embeddings, f)

    return embeddings  # also return them so the caller can use them immediately


def _get_catalog_embeddings() -> dict:  # returns the catalog embeddings, computing/loading them only once
    global _catalog_embeddings  # refers to the module-level cache variable declared above
    if _catalog_embeddings is not None:  # already loaded this run
        return _catalog_embeddings

    if _EMBED_CACHE_PATH.exists():  # a cache file from a previous run exists
        with open(_EMBED_CACHE_PATH, "r", encoding="utf-8") as f:
            _catalog_embeddings = json.load(f)  # load it instead of recomputing everything
        # Catalog was rebuilt (new/renamed ids) since the cache was written —
        # regenerate rather than silently missing the new items forever.
        catalog_ids = {p["id"] for p in get_products()}  # every id currently in catalog.json
        if not catalog_ids.issubset(_catalog_embeddings.keys()):  # the cache is missing one or more current catalog items
            _catalog_embeddings = _build_catalog_embeddings()  # rebuild from scratch so nothing is silently left out
    else:
        _catalog_embeddings = _build_catalog_embeddings()  # no cache at all yet — build it for the first time

    return _catalog_embeddings


def find_similar_garments(  # main entry point: given a query photo, return the most visually similar catalog products
    image_bytes: bytes,
    category: Optional[str] = None,  # optional filter: only consider "top" or "bottom" items
    gender: Optional[str] = None,  # optional filter: only consider "men" or "women" items
    top_k: int = 5,  # how many best matches to return
) -> list:
    catalog_embeddings = _get_catalog_embeddings()  # get (or build) every catalog item's embedding
    if not catalog_embeddings:  # nothing to compare against (e.g. CatVTON was unreachable during build)
        return []

    query_embedding = _embed_image_bytes(image_bytes)  # embed the user's uploaded photo the same way

    products_by_id = {p["id"]: p for p in get_products()}  # quick lookup from id back to the full product record
    scored = []  # will hold (similarity_score, product) pairs
    for product_id, embedding in catalog_embeddings.items():  # compare the query against every cached catalog embedding
        product = products_by_id.get(product_id)  # find the matching product record
        if not product:  # id exists in the embedding cache but not in the current catalog (e.g. removed item)
            continue
        if category and product["category"] != category:  # skip if it doesn't match the requested category filter
            continue
        if gender and product["gender"] != gender:  # skip if it doesn't match the requested gender filter
            continue
        scored.append((_cosine_similarity(query_embedding, embedding), product))  # compute how similar this item is to the query

    scored.sort(reverse=True, key=lambda x: x[0])  # highest similarity first
    return [  # build the final response, attaching the similarity score to each matched product
        {**product, "similarity": round(score, 4)}
        for score, product in scored[:top_k]  # only the best `top_k` matches
    ]
