import client from './client';

export interface OutfitSummary {
  likeCount: number;
  commentCount: number;
  liked: boolean;
  favorited: boolean;
}

export interface OutfitComment {
  id: number;
  text: string;
  createdAt: string;
  userId: number;
  username: string;
  avatar: string | null;
}

export interface FavoriteOutfit {
  favoriteId: number;
  tryOnHistoryId: number;
  createdAt: string;
  outfit: {
    id: number;
    resultImageUrl: string;
    selectedOutfitTitle: string;
    selectedOutfitCategory: string;
    selectedOutfitColor: string;
    prompt: string;
    createdAt: string;
  } | null;
}

const base = (id: number) => `/outfitsocial/${id}`;

export const getOutfitSummary = (historyId: number, userId: number) =>
  client.get<OutfitSummary>(`${base(historyId)}/summary`, { params: { userId } }).then(r => r.data);

export const toggleLike = (historyId: number, userId: number) =>
  client.post<{ liked: boolean; likeCount: number }>(`${base(historyId)}/like`, { userId }).then(r => r.data);

export const toggleFavorite = (historyId: number, userId: number) =>
  client.post<{ favorited: boolean }>(`${base(historyId)}/favorite`, { userId }).then(r => r.data);

export const getComments = (historyId: number) =>
  client.get<OutfitComment[]>(`${base(historyId)}/comments`).then(r => r.data);

export const addComment = (historyId: number, userId: number, text: string) =>
  client.post<OutfitComment>(`${base(historyId)}/comments`, { userId, text }).then(r => r.data);

export const deleteComment = (commentId: number, userId: number) =>
  client.delete(`/outfitsocial/comments/${commentId}`, { params: { userId } });

export const getFavorites = (userId: number) =>
  client.get<FavoriteOutfit[]>(`/outfitsocial/favorites/${userId}`).then(r => r.data);
