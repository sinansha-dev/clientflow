import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      original.url === '/auth/refresh'
    ) {
      return Promise.reject(error);
    }

    original._retry = true;
    refreshPromise ??= api
      .post('/auth/refresh')
      .then((response) => {
        const token = response.data?.data?.accessToken as string | undefined;
        setAccessToken(token ?? null);
        return token ?? null;
      })
      .finally(() => {
        refreshPromise = null;
      });

    const token = await refreshPromise;
    if (!token) {
      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  },
);
