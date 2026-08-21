import client from './client';

export interface AuthResponse {
  userId: number;
  fullName: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  email: string;
  token: string;
  isEmailVerified: boolean;
  needsNameSetup: boolean;
  isNewAccount: boolean;
}

export interface RegisterResponse {
  userId: number;
  email: string;
  message: string;
}

export interface RegisterRequest {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  identifier: string; // email or username
  password: string;
}

export const register = async (data: RegisterRequest): Promise<AuthResponse> => {
  const res = await client.post<AuthResponse>('/auth/register', data);
  return res.data;
};

export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const res = await client.post<AuthResponse>('/auth/login', data);
  return res.data;
};

export const verifyEmail = async (userId: number, code: string): Promise<AuthResponse> => {
  const res = await client.post<AuthResponse>('/auth/verify-email', { userId, code });
  return res.data;
};

export const resendCode = async (userId: number): Promise<void> => {
  await client.post('/auth/resend-code', { userId });
};

export const socialAuth = async (
  provider: string,
  email: string,
  fullName: string,
  providerId: string,
): Promise<AuthResponse> => {
  const res = await client.post<AuthResponse>('/auth/social', {
    provider, email, fullName, providerId,
  });
  return res.data;
};

export const updateProfile = async (
  fullName: string,
  username: string,
  bio: string | null,
  avatarUrl?: string | null,
): Promise<AuthResponse> => {
  const res = await client.put<AuthResponse>('/auth/profile', {
    fullName,
    username,
    bio,
    ...(avatarUrl !== undefined && { avatarUrl }),
  });
  return res.data;
};

export const changePassword = async (
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  await client.put('/auth/password', { userId, currentPassword, newPassword });
};
