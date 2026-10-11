// תפקיד הקובץ: זמן אמת ב-Socket.IO: אימות החיבור, חדר לכל משתמש ושליחת אירועים.
// משתמשים בו: notifications.service.js, server.js

// Real-time push over Socket.IO. Each connection authenticates with the same access token
// the REST API uses, then joins a room named after its own user id - so pushing to a user is
// just `io.to('user:<id>').emit(...)`, with no socket-to-user bookkeeping.
//
// Events sent to the browser:
//   notification:new       a full Notification row
//   notification:read      { id }
//   notification:read-all  {}
import { Server } from 'socket.io';
import { config } from '../config.js';
import { authenticateAccessToken } from '../middleware/auth.js';

let io = null;

const roomFor = (userId) => `user:${userId}`;

// מפעיל את Socket.IO על שרת ה-HTTP ומגדיר אימות וחדרים.
// נקרא מ: server.js
export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
  });

  // Runs once per connection attempt, before 'connection'. Calling next(error) rejects it.
  io.use(async (socket, next) => {
    try {
      const header = socket.handshake.headers.authorization;
      const token =
        socket.handshake.auth?.token ??
        (header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined);
      if (!token) throw new Error('No token provided');

      socket.data.user = await authenticateAccessToken(token);
      next();
    } catch (error) {
      next(new Error(`Unauthorized: ${error.message}`));
    }
  });

  io.on('connection', (socket) => {
    socket.join(roomFor(socket.data.user.userId));
    // Leaving the room on disconnect is automatic.
  });

  return io;
}

// שולח אירוע לכל החיבורים של משתמש אחד.
// נקרא מ: notifications.service.js
export function emitToUser(userId, event, payload) {
  io?.to(roomFor(userId)).emit(event, payload);
}
