import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BACKEND_PORT = 5010;
const CATVTON_PORT = 8000;
const OUTFIT_RECOMMENDER_PORT = 8001;

// Derives the dev machine's LAN IP from the Metro bundler connection, so it
// stays correct when the machine's IP changes instead of needing a hardcoded
// address. Falls back to localhost (e.g. web/simulator on the same machine).
const getDevServerHost = (): string => {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost;
  return hostUri ? hostUri.split(':')[0] : 'localhost';
};

export const BASE_URL = `http://${getDevServerHost()}:${BACKEND_PORT}`;
// CatVTON returns its result image as a relative path (it can't know which
// host a given device reached it through — 127.0.0.1 means something
// different to the phone than it does to the server). Resolve it against
// the same host this device already uses to reach everything else, just on
// CatVTON's own port instead of the .NET backend's.
export const CATVTON_BASE_URL = `http://${getDevServerHost()}:${CATVTON_PORT}`;
// Serves catalog garment photos for recommendation cards.
export const OUTFIT_RECOMMENDER_BASE_URL = `http://${getDevServerHost()}:${OUTFIT_RECOMMENDER_PORT}`;

const client = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: any) {
    super(message);
    this.name = 'ApiError';
  }
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status: number = error.response?.status ?? 0;
    const data = error.response?.data;
    const message: string =
      (typeof data === 'string' ? data : data?.message) ||
      error.message ||
      'Something went wrong';
    return Promise.reject(new ApiError(message, status, data));
  }
);

export default client;
