function normalizeUrl(url) {
  const v = String(url || '').trim();
  return v.endsWith('/') ? v.slice(0, -1) : v;
}

// For Vercel serverless deployment, use relative URLs
// Frontend and backend are on the same domain
const DEFAULT_API_BASE_URL = '/api';

export const DEBUG_API = import.meta.env.VITE_DEBUG_API === 'true';

export const API_BASE_URL = (() => {
  const raw = import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL;
  const base = normalizeUrl(raw);
  if (base.endsWith('/api')) return base;
  return `${base}/api`;
})();

// BACKEND_ORIGIN is no longer needed for Socket.io
// Keeping for backward compatibility
export const BACKEND_ORIGIN = (() => {
  try {
    const u = new URL(API_BASE_URL, window.location.origin);
    u.pathname = u.pathname.replace(/\/api$/, '');
    u.search = '';
    u.hash = '';
    return normalizeUrl(u.toString());
  } catch {
    return '';
  }
})();

export function buildApiUrl(path) {
  const p = String(path || '');
  const clean = p.startsWith('/') ? p.slice(1) : p;
  return new URL(clean, `${API_BASE_URL}/`).toString().replace(/\/$/, '');
}

export async function debugHealthCheck() {
  if (!DEBUG_API) return null;
  try {
    console.log('[DEBUG] ENV:', import.meta.env);
    console.log('[DEBUG] API URL:', API_BASE_URL);
  } catch {}
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
    const text = await res.text();
    console.log('[DEBUG] /health', res.status, text);
    return { status: res.status, body: text };
  } catch (e) {
    console.log('[DEBUG] /health failed', e);
    return null;
  }
}

