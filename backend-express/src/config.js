// ההגדרות של השרת מקובץ .env.

// כל ההגדרות שהשרת קורא מהסביבה (.env), במקום אחד.
import 'dotenv/config';
import path from 'node:path';

// התיקייה backend-express, כדי שנתיבים יחסיים ב-.env לא יהיו תלויים במקום שממנו הופעל node.
const ROOT = path.resolve(import.meta.dirname, '..');

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  }
  return value;
}

// אובייקט ההגדרות: פורט, מסד נתונים, סודות JWT, קבצים ו-Zoom.
// נקרא מ: app.js, db.js, auth.js, errorHandler.js +6
export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  uploadsDir: path.resolve(ROOT, process.env.UPLOADS_DIR ?? './uploads'),
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB ?? 10),
  isProduction: process.env.NODE_ENV === 'production',
  // RATE_LIMIT=off רק בבדיקות הדפדפן האוטומטיות, שמריצות הרבה תרחישים בדקה
  // מאותה כתובת. בכל מצב אחר המגבלה פעילה.
  rateLimitEnabled: process.env.RATE_LIMIT !== 'off',
  // אופציונלי - שיחות קוליות ופגישות Zoom כבויות עד שמגדירים את אלה (ראו modules/meetings/zoom.js).
  zoom: {
    accountId: process.env.ZOOM_ACCOUNT_ID ?? '',
    clientId: process.env.ZOOM_CLIENT_ID ?? '',
    clientSecret: process.env.ZOOM_CLIENT_SECRET ?? '',
  },
};
