// מופע axios המשותף.

import axios from 'axios';
import { clearTokens, getAccessToken, notifySessionExpired, setTokens } from './session';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

// מופע axios עם כתובת הבסיס של השרת וה-interceptors.
// נקרא מ: api.js, authApi.js
export const http = axios.create({ baseURL, withCredentials: true });

http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// מופע axios נקי (בלי interceptors) שמשמש רק את קריאת הרענון עצמה,
// כדי למנוע לולאה אינסופית אם נתיב הרענון יחזיר 401.
const refreshClient = axios.create({ baseURL, withCredentials: true });

let refreshPromise = null;

// מבקש אסימון גישה חדש בעזרת עוגיית הרענון.
// נקרא מ: הקובץ הזה
// קורא ל: setTokens, clearTokens
async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/auth/refresh', {})
      .then((res) => {
        setTokens(res.data);
        return res.data.accessToken;
      })
      .catch(() => {
        clearTokens();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config;
    const isAuthRoute = config?.url?.startsWith('/auth/');

    if (error.response?.status === 401 && config && !config._retried && !isAuthRoute) {
      config._retried = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        config.headers.set('Authorization', `Bearer ${newToken}`);
        return http(config);
      }
      notifySessionExpired();
    }

    const retryable = config?.method?.toLowerCase() === 'get' &&
      (!error.response || error.response.status >= 500);
    if (retryable && (config._retryCount ?? 0) < 2) {
      config._retryCount = (config._retryCount ?? 0) + 1;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** config._retryCount));
      return http(config);
    }

    return Promise.reject(error);
  },
);

// שולף מהשגיאה את ההודעה שהשרת שלח.
// נקרא מ: api.js, authApi.js
// קורא ל: —
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data;
    if (Array.isArray(body?.message)) return body.message.join(' ');
    if (typeof body?.message === 'string') return body.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
