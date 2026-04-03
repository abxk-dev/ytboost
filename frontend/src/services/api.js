import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest.url || '';

    // Skip interceptor for auth endpoints (login, register, check, refresh)
    const skipUrls = ['/auth/me', '/auth/refresh', '/auth/login', '/auth/register', '/admin/auth/me', '/admin/auth/refresh', '/admin/auth/login'];
    if (skipUrls.some(u => url.endsWith(u))) {
      return Promise.reject(error);
    }
    
    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try refreshing the token
        const isAdmin = url.includes('/admin/');
        const refreshEndpoint = isAdmin ? '/admin/auth/refresh' : '/auth/refresh';
        await api.post(refreshEndpoint);
        
        // Retry original request
        return api(originalRequest);
      } catch (refreshError) {
        // Only redirect if not already on a login page
        const path = window.location.pathname;
        const isAdmin = url.includes('/admin/');
        const loginPath = isAdmin ? '/admin/login' : '/login';
        if (path !== loginPath && path !== '/register' && path !== '/') {
          window.location.href = loginPath;
        }
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper to format API error messages
export function formatApiError(error) {
  const detail = error.response?.data?.detail;
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
