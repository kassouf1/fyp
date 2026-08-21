import requests


def map_category(api_category: str, title: str):
    text = f"{api_category} {title}".lower()

    if any(word in text for word in ["shoe", "shoes", "sneaker", "sneakers", "boot", "boots"]):
        return "shoes"

    if any(word in text for word in ["jean", "jeans", "pant", "pants", "trouser", "trousers", "shorts", "skirt"]):
        return "bottom"

    if any(word in text for word in ["shirt", "t-shirt", "tshirt", "jacket", "hoodie", "sweater", "top", "coat"]):
        return "top"

    if "clothing" in api_category.lower():
        return "top"

    return "unknown"


def normalize_product(item):
    return {
        "id": str(item["id"]),
        "brand": "FakeStore",
        "title": item["title"],
        "category": map_category(item["category"], item["title"]),
        "color": "unknown",
        "season": "all",
        "style": ["casual"],
        "price": float(item["price"]),
        "image_url": item["image"],
    }


def get_products():
    url = "https://fakestoreapi.com/products"
    response = requests.get(url)
    response.raise_for_status()
    data = response.json()

    normalized_products = [normalize_product(item) for item in data]

    clothing_products = [
        product for product in normalized_products
        if product["category"] in ["top", "bottom", "shoes"]
    ]
   
    return clothing_products