import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // בלי host מפורש, Vite נקשר לשם "localhost", שבחלק מהתקנות
    // Windows מתורגם ל-IPv6 בלבד (::1) - דפדפן שמנסה קודם 127.0.0.1
    // (IPv4) מקבל אז סירוב חיבור / "Network Error" למרות שהשרת
    // באמת רץ. קשירה מפורשת לכתובת ה-IPv4 המקומית מונעת את זה.
    host: '127.0.0.1',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: true,
    // קובצי *.spec.js של Playwright נמצאים תחת e2e/ ומשתמשים ב-test/expect של @playwright/test,
    // ולא של Vitest - הם מוחרגים כאן כדי ש-Vitest לא ינסה (וייכשל) להריץ אותם כבדיקות יחידה.
    exclude: ['e2e/**', 'node_modules/**'],
    // נתיב הפרויקט מכיל תווים שאינם ASCII (עברית) ורווחים. מאגר התהליכים של
    // Vitest כברירת מחדל מתקשר דרך RPC פנימי מבוסס fetch(), שנתקע לדקות
    // ואז נכשל בזמן קצוב מול נתיב כזה - forks (שימוש ב-child_process.fork רגיל, בלי
    // מעבר דרך כתובת) עוקף את הבעיה לגמרי.
    pool: 'forks',
  },
});
