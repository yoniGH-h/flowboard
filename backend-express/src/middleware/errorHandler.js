// טיפול אחיד בשגיאות.

import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';

// כתובת לא מוכרת תחת /api -> 404 באותו מבנה JSON של כל שגיאה אחרת.
// מחזיר 404 לכתובת שלא קיימת תחת /api.
// נקרא מ: app.js
// קורא ל: —
export function notFoundHandler(req, res) {
  res.status(404).json({
    statusCode: 404,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    message: `Cannot ${req.method} ${req.path}`,
  });
}

// Express מזהה מטפל שגיאות לפי 4 הפרמטרים שלו. Express 5 מעביר לכאן אוטומטית
// שגיאות שנזרקו בנתיבים אסינכרוניים, ולכן הנתיבים לא צריכים try/catch.
// לכל תשובת שגיאה יש המבנה { statusCode, path, timestamp, message } -
// האתר קורא את message (מחרוזת או מערך מחרוזות) ומציג אותו למשתמש.
// מטפל השגיאות המרכזי: קובע קוד והודעה ומחזיר JSON.
// נקרא מ: app.js
// קורא ל: HttpError
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let message = 'Internal server error';

  if (err instanceof HttpError) {
    status = err.status;
    message = err.body;
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? `File exceeds the maximum allowed size of ${config.maxUploadSizeMb} MB` : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  } else {
    console.error(err);
  }

  res.status(status).json({
    statusCode: status,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    message,
  });
}
