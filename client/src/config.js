// Centralized API base URL.
// In production, VITE_API_BASE_URL is injected by the build host (Netlify env vars).
// During `vite dev` we fall back to the dev server proxy (see vite.config.js),
// so relative '/api' requests work locally without extra config.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export function apiUrl(path) {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }
  return path;
}