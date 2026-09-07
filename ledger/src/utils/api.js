// ============================================================
// API Utility — src/utils/api.js
// Central fetch wrapper that:
//   - Points to the .NET backend
//   - Auto-attaches JWT Bearer token from localStorage
//   - Handles 401 (auto-logs out on token expiry)
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function request(method, path, body = null) {
  const token = localStorage.getItem('ledger_token');

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);

  // Auto-logout on token expiry
  if (res.status === 401) {
    localStorage.removeItem('ledger_token');
    localStorage.removeItem('ledger_user');
    window.location.href = '/login';
    return;
  }

  // Return parsed JSON or throw with error message
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message = data?.message || data || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path)         => request('DELETE', path),
};
