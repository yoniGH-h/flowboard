// חיבור Socket.IO לשרת.

import { io } from 'socket.io-client';
import { getAccessToken } from '../api/session';

// התראות בזמן אמת: השרת שולח אותן ב-Socket.IO. החיבור עטוף
// בממשק קטן - on / off / start / stop - שמשמש את useNotificationsSocket.

// נקודת הקצה של Socket.IO נמצאת בכתובת הבסיס של שרת ה-API (לא תחת הקידומת
// /api), ולכן מסירים אותה מאותו VITE_API_URL שמשמש את ה-REST, במקום להוסיף
// משתנה סביבה שני. עם VITE_API_URL=/api התוצאה היא '' - כלומר אותה כתובת מקור.
const SERVER_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/api\/?$/, '');

// חיבור חדש בכל קריאה, כדי שהמחזור של React StrictMode (עלייה -> ירידה -> עלייה) לא
// ישתמש שוב בחיבור שעדיין נסגר. האסימון נקרא בכל התחברות (גם חוזרת), כך
// שאסימון גישה שחודש נקלט אוטומטית אחרי ניתוק.
// יוצר חיבור ומחזיר ארבע פעולות: on, off, start, stop.
// נקרא מ: useNotificationsSocket.js
// קורא ל: getAccessToken
export function createNotificationsConnection() {
  const socket = io(SERVER_BASE || undefined, {
    autoConnect: false,
    // פונקציה, כדי שכל התחברות מחדש תשלח את האסימון העדכני.
    auth: (cb) => cb({ token: getAccessToken() ?? '' }),
  });

  return {
    on: (event, handler) => socket.on(event, handler),
    off: (event, handler) => socket.off(event, handler),
    start: async () => {
      socket.connect();
    },
    stop: async () => {
      socket.disconnect();
    },
  };
}
