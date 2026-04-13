import { API_BASE_URL, DEBUG_API, buildApiUrl } from '../config/apiConfig';

export class ApiError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

function shouldJson(res) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') || ct.includes('+json');
}

export async function apiFetch(path, options = {}) {
  const url = buildApiUrl(path);
  const {
    method = 'GET',
    headers = {},
    body,
    token,
    credentials = 'include',
    timeoutMs = 20000,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const finalHeaders = { ...headers };
  if (!finalHeaders.Accept) finalHeaders.Accept = 'application/json';
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let payload = body;
  if (body != null && typeof body === 'object' && !(body instanceof FormData)) {
    if (!finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  if (DEBUG_API) {
    console.log('[API] base =', API_BASE_URL);
    console.log('[API] request =', { method, url });
  }

  try {
    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: payload,
      credentials,
      signal: controller.signal,
    });

    let parsed;
    if (shouldJson(res)) parsed = await res.json().catch(() => null);
    else parsed = await res.text().catch(() => '');

    if (DEBUG_API) {
      console.log('[API] response =', { url, status: res.status, ok: res.ok });
    }

    if (!res.ok) {
      const msg =
        (parsed && typeof parsed === 'object' && (parsed.detail || parsed.error)) ||
        (typeof parsed === 'string' && parsed) ||
        `Request failed (${res.status})`;
      throw new ApiError(String(msg), { status: res.status, url, body: parsed });
    }

    return parsed;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('Network error: failed to reach backend', { status: 0, url, body: String(e?.message || e) });
  } finally {
    clearTimeout(timeoutId);
  }
}
