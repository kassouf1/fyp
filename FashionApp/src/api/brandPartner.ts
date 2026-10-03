import client from './client';

export interface BrandPartnerApplication {
  brandName: string;
  contactEmail: string;
  apiBaseUrl: string;
  apiKey?: string;
  category?: string;
}

export type BrandPartnerStatus = 'Pending' | 'Active' | 'Failed';

export interface BrandPartnerResult {
  id: number;
  brandName: string;
  contactEmail: string;
  apiBaseUrl: string;
  category?: string | null;
  status: BrandPartnerStatus;
  lastError?: string | null;
  productCount: number;
  createdAt: string;
  lastSyncedAt?: string | null;
}

// Connects a brand's product API and pulls their catalog in immediately —
// the response already reflects whether the sync succeeded, so the caller
// doesn't need a separate "check status" step.
export const applyBrandPartner = async (data: BrandPartnerApplication): Promise<BrandPartnerResult> => {
  const res = await client.post<BrandPartnerResult>('/brandpartners/apply', data, { timeout: 25000 });
  return res.data;
};

export const resyncBrandPartner = async (id: number): Promise<BrandPartnerResult> => {
  const res = await client.post<BrandPartnerResult>(`/brandpartners/${id}/resync`, {}, { timeout: 25000 });
  return res.data;
};
