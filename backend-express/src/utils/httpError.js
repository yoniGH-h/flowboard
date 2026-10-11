// תפקיד הקובץ: שגיאה שנושאת קוד HTTP, ופונקציות קיצור ליצירתה.
// משתמשים בו: auth.js, errorHandler.js, attachments.routes.js, auth.routes.js +14

// An error that carries an HTTP status code. Services throw these; the error-handler
// middleware (middleware/errorHandler.js) turns them into the JSON error response.
//
//   throw notFound('Task not found')   ->   404 { statusCode: 404, message: 'Task not found', ... }
// מחלקת שגיאה עם קוד סטטוס והודעה.
// נקרא מ: errorHandler.js, meetings.routes.js, zoom.js
export class HttpError extends Error {
  constructor(status, message) {
    super(Array.isArray(message) ? message.join(' ') : message);
    this.status = status;
    this.body = message;
  }
}

// יוצר שגיאת 400: הקלט לא תקין.
// נקרא מ: attachments.routes.js, auth.service.js, meetings.routes.js, permissions.service.js +3
export const badRequest = (message = 'Bad Request') => new HttpError(400, message);
// יוצר שגיאת 401: לא מזוהה.
// נקרא מ: auth.js, auth.routes.js, auth.service.js
export const unauthorized = (message = 'Unauthorized') => new HttpError(401, message);
// יוצר שגיאת 403: אין הרשאה.
// נקרא מ: auth.js, attachments.routes.js, comments.routes.js, notifications.service.js +5
export const forbidden = (message = 'Forbidden') => new HttpError(403, message);
// יוצר שגיאת 404: לא נמצא.
// נקרא מ: attachments.routes.js, automation-rules.service.js, comments.routes.js, meetings.routes.js +8
export const notFound = (message = 'Not Found') => new HttpError(404, message);
// יוצר שגיאת 409: התנגשות עם המצב הקיים.
// נקרא מ: auth.service.js, projects.service.js, tasks.service.js
export const conflict = (message = 'Conflict') => new HttpError(409, message);
// יוצר שגיאת 413: הגוף גדול מדי.
// נקרא מ: אין שימוש כרגע
export const payloadTooLarge = (message = 'Payload Too Large') => new HttpError(413, message);
