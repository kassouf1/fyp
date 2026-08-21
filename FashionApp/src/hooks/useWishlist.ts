import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BrandProduct, fetchBrandProducts } from '../data/localClothes';

const KEY = '@wishlist_ids';

async function readIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(ids));
}

export function useWishlist() {
  const [ids, setIds] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<BrandProduct[]>([]);

  useEffect(() => {
    readIds().then(setIds);
    fetchBrandProducts().then(setCatalog).catch(() => {});
  }, []);

  const toggle = useCallback(async (productId: string) => {
    const current = await readIds();
    const next = current.includes(productId)
      ? current.filter(i => i !== productId)
      : [...current, productId];
    await writeIds(next);
    setIds(next);
    return next.includes(productId);
  }, []);

  const isSaved = useCallback((productId: string) => ids.includes(productId), [ids]);

  const items: BrandProduct[] = catalog.filter(p => ids.includes(p.id));

  const remove = useCallback(async (productId: string) => {
    const next = (await readIds()).filter(i => i !== productId);
    await writeIds(next);
    setIds(next);
  }, []);

  return { isSaved, toggle, items, remove, count: ids.length };
}
