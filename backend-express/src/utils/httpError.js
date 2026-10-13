// שגיאות שנושאות קוד HTTP.

// מחלקת שגיאה עם קוד סטטוס והודעה.
export class HttpError extends Error {
  constructor(status, message) {
    super(Array.isArray(message) ? message.join(' ') : message);
    this.status = status;
    this.body = message;
  }
}

// יוצר שגיאת 400: הקלט לא תקין.
export const badRequest = (message = 'Bad Request') => new HttpError(400, message);
// יוצר שגיאת 401: לא מזוהה.
export const unauthorized = (message = 'Unauthorized') => new HttpError(401, message);
// יוצר שגיאת 403: אין הרשאה.
export const forbidden = (message = 'Forbidden') => new HttpError(403, message);
// יוצר שגיאת 404: לא נמצא.
export const notFound = (message = 'Not Found') => new HttpError(404, message);
// יוצר שגיאת 409: התנגשות עם המצב הקיים.
export const conflict = (message = 'Conflict') => new HttpError(409, message);
// יוצר שגיאת 413: הגוף גדול מדי.
export const payloadTooLarge = (message = 'Payload Too Large') => new HttpError(413, message);
