// Token storage + a tiny pub-sub so AuthContext can react when the axios
// interceptor decides a session is no longer valid (refresh failed).
const ACCESS_KEY = 'flowboard.accessToken';
const LEGACY_REFRESH_KEY = 'flowboard.refreshToken';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function setTokens(tokens) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.removeItem(LEGACY_REFRESH_KEY);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(LEGACY_REFRESH_KEY);
}

let expiredHandler = null;

export function onSessionExpired(handler) {
  expiredHandler = handler;
}

export function notifySessionExpired() {
  clearTokens();
  expiredHandler?.();
}
