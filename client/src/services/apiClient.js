import axios from 'axios';
import { config } from '../config/env';

const normalizeBaseUrl = (baseUrl = '') => {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (!trimmed) return '/api/v1';
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
};

const apiClient = axios.create({
  baseURL: normalizeBaseUrl(config.apiBaseUrl),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default apiClient;
