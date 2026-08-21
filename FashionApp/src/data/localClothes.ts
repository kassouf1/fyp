import { OUTFIT_RECOMMENDER_BASE_URL } from '../api/client';

export interface BrandProduct {
  id: string;
  name: string;
  brand: string;
  price: string;
  imageUrl: string;
  tags: string[];
  // Catalog id of this exact garment — lets try-on use it directly instead
  // of re-downloading the image, and guarantees it's one of our own items.
  topId: string;
}

interface CatalogProduct {
  id: string;
  brand: string;
  title: string;
  category: string;
  color: string;
  season: string;
  style: string[];
  price: number;
  // Two different "image" fields come back from /catalog: image_url is an
  // absolute local filesystem path (what the Python try-on service opens
  // directly), image_path is the same file served over HTTP — that's the
  // one the app needs for <Image>.
  image_path: string;
}

const toBrandProduct = (p: CatalogProduct): BrandProduct => ({
  id: p.id,
  name: p.title,
  brand: p.brand && p.brand !== 'Kaggle' ? p.brand : '',
  price: p.price > 0 ? `£${p.price.toFixed(2)}` : '',
  imageUrl: `${OUTFIT_RECOMMENDER_BASE_URL}${p.image_path}`,
  tags: [p.category, p.color, p.season, ...p.style, ...p.title.toLowerCase().split(/\s+/)],
  topId: p.id,
});

let cache: BrandProduct[] | null = null;
let inFlight: Promise<BrandProduct[]> | null = null;

// Fetches Brand Shop's catalog from our own outfit-recommender dataset — the
// same items used for AI recommendations — so every item shown is
// guaranteed to work with virtual try-on, instead of pulling random items
// from unrelated third-party image sources. Cached after the first call.
export const fetchBrandProducts = async (): Promise<BrandProduct[]> => {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = fetch(`${OUTFIT_RECOMMENDER_BASE_URL}/catalog`)
      .then(res => res.json())
      .then((data: CatalogProduct[]) => {
        cache = data.map(toBrandProduct);
        return cache;
      })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
};

// Synchronous access to whatever's cached so far — for callers (like the
// wishlist) that need a snapshot rather than an awaited fetch.
export const getCachedBrandProducts = (): BrandProduct[] => cache ?? [];

export const filterLocalClothes = (products: BrandProduct[], query: string): BrandProduct[] => {
  const q = query.toLowerCase().trim();
  if (!q) return products;
  return products.filter(item =>
    item.brand.toLowerCase().includes(q) ||
    item.name.toLowerCase().includes(q) ||
    item.tags.some(t => t.includes(q))
  );
};
