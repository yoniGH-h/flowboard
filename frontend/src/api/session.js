// שמירת האסימון בדפדפן.

// שמירת האסימון, ומנגנון הודעות קטן שמאפשר ל-AuthContext להגיב כשה-interceptor
// של axios מחליט שהחיבור כבר לא תקף (הרענון נכשל).
const ACCESS_KEY = 'flowboard.accessToken';
const LEGACY_REFRESH_KEY = 'flowboard.refreshToken';

// מחזיר את אסימון הגישה השמור.
// נקרא מ: http.js, AuthContext.jsx, socket.js
// קורא ל: —
export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

// שומר את אסימון הגישה.
// נקרא מ: authApi.js, http.js
// קורא ל: —
export function setTokens(tokens) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.removeItem(LEGACY_REFRESH_KEY);
}

// מוחק את האסימון השמור.
// נקרא מ: authApi.js, http.js, וגם בקובץ הזה
// קורא ל: —
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(LEGACY_REFRESH_KEY);
}

let expiredHandler = null;

// רושם פונקציה שתיקרא כשהחיבור פג.
// נקרא מ: AuthContext.jsx
// קורא ל: —
export function onSessionExpired(handler) {
  expiredHandler = handler;
}

// מודיע שהחיבור פג ואי אפשר לחדש אותו.
// נקרא מ: http.js
// קורא ל: clearTokens
export function notifySessionExpired() {
  clearTokens();
  expiredHandler?.();
}
