import { Platform } from 'react-native';
import client, { OUTFIT_RECOMMENDER_BASE_URL } from './client';

// On native, RN's XHR polyfill understands the {uri, name, type} shorthand
// for multipart file parts. On web, FormData needs a real Blob/File — the
// picked image's uri is a blob: URL there, so fetch it back into a Blob.
const appendFilePart = async (
  formData: FormData,
  field: string,
  uri: string,
  name: string,
  type: string,
): Promise<void> => {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    formData.append(field, blob, name);
  } else {
    formData.append(field, { uri, name, type } as any);
  }
};

export interface OutfitItem {
  id?: number;
  title: string;
  top: string;
  bottom: string;
  color?: string;
  category?: string;
  // Catalog id of the recommended top, so try-on can use that exact garment
  // directly instead of re-guessing one from the outfit's text description.
  topId?: string;
  bottomId?: string;
  imageUrl?: string;
  bottomImageUrl?: string;
}

export interface RecommendRequest {
  prompt: string;
}

export interface TryOnHistoryItem {
  id: number;
  userId: number;
  prompt: string;
  selectedOutfitTitle: string;
  selectedOutfitColor: string;
  selectedOutfitCategory: string;
  personImageUrl: string;
  resultImageUrl: string;
  createdAt: string;
}

export interface TryOnResult {
  result_url?: string;
  catvton_result?: {
    result_url?: string;
    result_image?: string;
  };
}

export const recommendOutfit = async (data: RecommendRequest): Promise<OutfitItem[]> => {
  const res = await client.post<OutfitItem[]>('/outfit/recommend', data);
  return res.data;
};

export type GarmentMode = 'top' | 'bottom' | 'both';

export const generateTryOn = async (params: {
  userId: number;
  prompt: string;
  selectedOutfitTitle: string;
  selectedOutfitColor: string;
  selectedOutfitCategory: string;
  personImageUri: string;
  personImageName: string;
  personImageType: string;
  clothesImageUri?: string;
  clothesImageName?: string;
  clothesImageType?: string;
  clothesImageUrl?: string;
  topId?: string;
  bottomImageUri?: string;
  bottomImageName?: string;
  bottomImageType?: string;
  bottomImageUrl?: string;
  bottomId?: string;
  garmentMode?: GarmentMode;
}): Promise<TryOnResult> => {
  const formData = new FormData();
  formData.append('UserId', String(params.userId));
  formData.append('Prompt', params.prompt);
  formData.append('SelectedOutfitTitle', params.selectedOutfitTitle);
  formData.append('SelectedOutfitColor', params.selectedOutfitColor);
  formData.append('SelectedOutfitCategory', params.selectedOutfitCategory);
  formData.append('GarmentMode', params.garmentMode ?? 'top');
  if (params.topId) {
    formData.append('TopId', params.topId);
  }
  if (params.bottomId) {
    formData.append('BottomId', params.bottomId);
  }
  await appendFilePart(
    formData, 'PersonImage',
    params.personImageUri, params.personImageName, params.personImageType,
  );
  if (params.clothesImageUri) {
    await appendFilePart(
      formData, 'ClothesImage',
      params.clothesImageUri, params.clothesImageName ?? 'clothes.jpg', params.clothesImageType ?? 'image/jpeg',
    );
  }
  if (params.clothesImageUrl) {
    formData.append('ClothesImageUrl', params.clothesImageUrl);
  }
  if (params.bottomImageUri) {
    await appendFilePart(
      formData, 'BottomImage',
      params.bottomImageUri, params.bottomImageName ?? 'bottom.jpg', params.bottomImageType ?? 'image/jpeg',
    );
  }
  if (params.bottomImageUrl) {
    formData.append('BottomImageUrl', params.bottomImageUrl);
  }

  // On web, an explicit multipart/form-data header (with no boundary) makes
  // the browser send it as-is instead of auto-generating one with the
  // required boundary param, which breaks parsing server-side. `undefined`
  // removes the client's default header so the browser can set its own.
  // Native's XHR polyfill needs the explicit header, so only unset it on web.
  const res = await client.post<TryOnResult>('/outfit/generate-tryon', formData, {
    headers: Platform.OS === 'web'
      ? { 'Content-Type': undefined }
      : { 'Content-Type': 'multipart/form-data' },
    // "Both" mode chains two 30-step passes — stay comfortably under the
    // backend's 5-minute AiBackend client timeout rather than the old 2
    // minutes, which a chained run can now legitimately exceed.
    timeout: 280000,
  });
  return res.data;
};

export const getTryOnHistory = async (userId: number): Promise<TryOnHistoryItem[]> => {
  const res = await client.get<TryOnHistoryItem[]>(`/outfit/history/${userId}`);
  return res.data;
};

interface RawSimilarGarmentMatch {
  id: string;
  title: string;
  image_path: string;
  similarity: number;
}

export interface SimilarGarmentMatch {
  id: string;
  title: string;
  imageUrl: string;
  similarity: number;
}

// Finds the closest-looking items in our own garment catalog to a photo
// (e.g. a post someone else shared) — try-on works far better against a
// clean product photo than against another photo of a person wearing it.
export const findSimilarGarment = async (
  imageUrl: string,
  category?: string,
  gender?: string,
): Promise<SimilarGarmentMatch[]> => {
  const res = await client.post<{ matches: RawSimilarGarmentMatch[] }>(
    '/outfit/find-similar-garment',
    { imageUrl, category, gender },
    // First search after a catalog rebuild embeds every catalog image, not
    // just the query photo — give it the same headroom as try-on itself.
    { timeout: 280000 },
  );
  return res.data.matches.map(m => ({
    id: m.id,
    title: m.title,
    imageUrl: `${OUTFIT_RECOMMENDER_BASE_URL}${m.image_path}`,
    similarity: m.similarity,
  }));
};
