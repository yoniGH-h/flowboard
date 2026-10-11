// תפקיד הקובץ: שמירת אסימון הגישה בדפדפן, והודעה לאתר כשהחיבור פג.
// משתמשים בו: authApi.js, http.js, AuthContext.jsx, socket.js

// שמירת האסימון, ומנגנון הודעות קטן שמאפשר ל-AuthContext להגיב כשה-interceptor
// של axios מחליט שהחיבור כבר לא תקף (הרענון נכשל).
const ACCESS_KEY = 'flowboard.accessToken';
const LEGACY_REFRESH_KEY = 'flowboard.refreshToken';

// מחזיר את אסימון הגישה השמור.
// נקרא מ: http.js, AuthContext.jsx, socket.js
export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

// שומר את אסימון הגישה.
// נקרא מ: authApi.js, http.js
export function setTokens(tokens) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.removeItem(LEGACY_REFRESH_KEY);
}

// מוחק את האסימון השמור.
// נקרא מ: authApi.js, http.js
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(LEGACY_REFRESH_KEY);
}

let expiredHandler = null;

// רושם פונקציה שתיקרא כשהחיבור פג.
// נקרא מ: AuthContext.jsx
export function onSessionExpired(handler) {
  expiredHandler = handler;
}

// מודיע שהחיבור פג ואי אפשר לחדש אותו.
// נקרא מ: http.js
export function notifySessionExpired() {
  clearTokens();
  expiredHandler?.();
}
