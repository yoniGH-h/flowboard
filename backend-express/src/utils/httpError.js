// An error that carries an HTTP status code. Services throw these; the error-handler
// middleware (middleware/errorHandler.js) turns them into the JSON error response.
//
//   throw notFound('Task not found')   ->   404 { statusCode: 404, message: 'Task not found', ... }
export class HttpError extends Error {
  constructor(status, message) {
    super(Array.isArray(message) ? message.join(' ') : message);
    this.status = status;
    this.body = message;
  }
}

export const badRequest = (message = 'Bad Request') => new HttpError(400, message);
export const unauthorized = (message = 'Unauthorized') => new HttpError(401, message);
export const forbidden = (message = 'Forbidden') => new HttpError(403, message);
export const notFound = (message = 'Not Found') => new HttpError(404, message);
export const conflict = (message = 'Conflict') => new HttpError(409, message);
export const payloadTooLarge = (message = 'Payload Too Large') => new HttpError(413, message);
