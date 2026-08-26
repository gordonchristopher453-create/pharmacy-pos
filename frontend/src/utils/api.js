import axios from 'axios';
import toast from 'react-hot-toast';
import { store } from '../store/store';
import { logout } from '../store/slices/authSlice';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : `${window.location.origin}/api`,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const state = store.getState();
  const token = state.auth?.token || state.auth?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status;
    const message = error.response?.data?.message
                 || error.response?.data?.error
                 || error.message
                 || 'An unexpected error occurred';
    const url     = error.config?.url || '';

    // Auth errors
    if (status === 401 && !url.includes('/auth/login')) {
      toast.error('Session expired. Please log in again.');
      store.dispatch(logout());
      return Promise.reject(error);
    }

    if (status === 403) {
      toast.error(`Access denied: ${message}`);
      return Promise.reject(error);
    }

    if (status === 404) {
      toast.error(`Not found: ${url}`);
      return Promise.reject(error);
    }

    if (status === 429) {
      toast.error('Too many requests. Please wait a moment.');
      return Promise.reject(error);
    }

    if (status >= 500) {
      toast.error(`Server error: ${message}`);
      console.error('[API 500]', url, message);
      return Promise.reject(error);
    }

    // Let caller handle 400s with specific messages
    return Promise.reject(error);
  }
);

export default api;
