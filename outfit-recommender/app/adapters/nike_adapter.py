import os
import requests
from dotenv import load_dotenv

load_dotenv()

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
RAPIDAPI_HOST = os.getenv("RAPIDAPI_HOST")


def normalize_product(item, category):
    title = item.get("title") or item.get("name") or "Nike Product"

    image_url = ""
    images = item.get("images") or item.get("imageUrls") or []

    if isinstance(images, list) and images:
        first = images[0]
        if isinstance(first, str):
            image_url = first
        elif isinstance(first, dict):
            image_url = first.get("url", "")

    price = item.get("price", 0)
    try:
        price = float(price)
    except:
        price = 0.0

    return {
        "id": str(item.get("id", "")),
        "brand": "Nike",
        "title": title,
        "category": category,
        "color": "unknown",
        "season": "all",
        "style": ["casual"],
        "price": price,
        "image_url": image_url,
    }


def get_shoes_men():
    url = "https://nike-products.p.rapidapi.com/shoes/men-shoes"

    headers = {
        "Content-Type": "application/json",
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
    }

    response = requests.get(url, headers=headers, timeout=30)
    print("SHOES STATUS:", response.status_code)
    print("SHOES BODY:", response.text[:1000])

    response.raise_for_status()
    data = response.json()

    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        items = (
            data.get("products")
            or data.get("data")
            or data.get("results")
            or data.get("items")
            or []
        )
    else:
        items = []

    return [normalize_product(item, "shoes") for item in items]

def get_clothing_men():
    url = "https://nike-api.p.rapidapi.com/query-clothing-men"

    headers = {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST
    }

    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    data = response.json()

    print("CLOTHING RESPONSE:", data)

    items = data if isinstance(data, list) else data.get("products", [])
    normalized = []

    for item in items:
        title = (item.get("title") or item.get("name") or "").lower()

        if any(word in title for word in ["pant", "pants", "short", "shorts", "jogger", "trouser"]):
            category = "bottom"
        else:
            category = "top"

        normalized.append(normalize_product(item, category))

    return normalized


def get_products():
    return get_shoes_men()
print("KEY EXISTS:", bool(RAPIDAPI_KEY))
print("HOST:", RAPIDAPI_HOST)