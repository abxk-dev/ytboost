import axios from 'axios';
import { API_BASE_URL, DEBUG_API } from '../config/apiConfig';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const url = String(config.url || '');
  const isAdminRequest = url.startsWith('/admin/') || url.startsWith('admin/');

  const userToken = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
  const adminToken = typeof window !== 'undefined' ? window.localStorage.getItem('admin_token') : null;
  const tokenToUse = isAdminRequest ? adminToken : userToken;

  config.headers = config.headers || {};
  if (tokenToUse) {
    config.headers.Authorization = `Bearer ${tokenToUse}`;
  } else {
    delete config.headers.Authorization;
  }

  if (DEBUG_API) {
    try {
      console.log('DEBUG TOKEN:', tokenToUse);
      console.log('AUTH HEADER:', config.headers?.Authorization);
      console.log('DEBUG HEADERS:', config.headers);
    } catch {}
  }
  return config;
});

api.interceptors.request.use((config) => {
  if (DEBUG_API) {
    const base = config.baseURL || '';
    const url = config.url || '';
    console.log('[API] request', { method: config.method, url: `${base}${url}` });
  }
  return config;
});

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest.url || '';

    // Skip interceptor for auth endpoints (login, register, check, refresh)
    const skipUrls = ['/auth/login', '/auth/register', '/auth/refresh', '/admin/auth/login', '/admin/auth/refresh'];
    if (skipUrls.some(u => url.endsWith(u))) {
      return Promise.reject(error);
    }
    
    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const isAdmin = url.startsWith('/admin/') || url.includes('/admin/');
        if (isAdmin) {
          const adminRefresh = typeof window !== 'undefined' ? window.localStorage.getItem('admin_refresh_token') : null;
          if (!adminRefresh) return Promise.reject(error);

          const { data } = await api.post('/admin/auth/refresh', { refresh_token: adminRefresh });
          const nextAccess = data?.access_token;
          const nextRefresh = data?.refresh_token;
          if (typeof nextAccess === 'string' && nextAccess) {
            window.localStorage.setItem('admin_token', nextAccess);
          }
          if (typeof nextRefresh === 'string' && nextRefresh) {
            window.localStorage.setItem('admin_refresh_token', nextRefresh);
          }
          return api(originalRequest);
        }

        const refreshToken = typeof window !== 'undefined' ? window.localStorage.getItem('refresh_token') : null;
        if (!refreshToken) {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('token');
            window.localStorage.removeItem('refresh_token');
          }
          return Promise.reject(error);
        }

        const { data } = await api.post('/auth/refresh', { refresh_token: refreshToken });
        const nextAccess = data?.access_token;
        const nextRefresh = data?.refresh_token;
        if (typeof nextAccess === 'string' && nextAccess) {
          window.localStorage.setItem('token', nextAccess);
        }
        if (typeof nextRefresh === 'string' && nextRefresh) {
          window.localStorage.setItem('refresh_token', nextRefresh);
        }
        
        // Retry original request
        return api(originalRequest);
      } catch (refreshError) {
        try {
          const isAdmin = url.startsWith('/admin/') || url.includes('/admin/');
          if (isAdmin) {
            window.localStorage.removeItem('admin_token');
            window.localStorage.removeItem('admin_refresh_token');
          } else {
            window.localStorage.removeItem('token');
            window.localStorage.removeItem('refresh_token');
          }
        } catch {}

        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const to = (url.startsWith('/admin/') || url.includes('/admin/')) ? '/admin/login' : '/login';
        if (path !== to && path !== '/register' && path !== '/') window.location.href = to;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Helper to format API error messages
export function formatApiError(error) {
  const looksLikeHtml = (v) => typeof v === 'string' && v.trim().startsWith('<');
  const isProxyError = (v) => typeof v === 'string' && v.includes('Error occurred while trying to proxy');

  if (!error.response) {
    const apiUrl = API_BASE_URL;
    const msg = String(error.message || '');
    if (msg.toLowerCase().includes('network') || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
      return `Cannot reach backend (${apiUrl}). This is usually CORS (backend not allowing your Vercel domain) or a network block.`;
    }
    return `Request failed. Backend may be offline (${apiUrl}).`;
  }

  if (looksLikeHtml(error.response?.data) || isProxyError(error.response?.data)) {
    return `Cannot reach backend (${API_BASE_URL}). This is usually a proxy/CORS issue.`;
  }

  const errMsg = error.response?.data?.error;
  if (typeof errMsg === 'string' && errMsg.trim()) return errMsg;

  const detail = error.response?.data?.detail;
  const status = error.response?.status;
  if (detail == null && typeof status === 'number' && status >= 500) {
    return `Backend error (${status}). Check backend logs.`;
  }
  if (detail == null) return 'Something went wrong. Please try again.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(' ');
  }
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
}

export default api;
