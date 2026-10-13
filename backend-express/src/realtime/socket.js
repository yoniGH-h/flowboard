// זמן אמת ב-Socket.IO.

// שליחה בזמן אמת ב-Socket.IO. כל חיבור מזדהה עם אותו אסימון גישה שמשמש את
// ה-REST API, ואז מצטרף לחדר שנקרא על שם מזהה המשתמש שלו - כך ששליחה למשתמש היא
// פשוט io.to('user:<id>').emit(...), בלי לנהל רשימה של חיבורים לכל משתמש.
//
// האירועים שנשלחים לדפדפן:
//   notification:new       שורת Notification מלאה
//   notification:read      { id }
//   notification:read-all  {}
import { Server } from 'socket.io';
import { config } from '../config.js';
import { authenticateAccessToken } from '../middleware/auth.js';

let io = null;

// מחזיר את שם החדר של משתמש.
const roomFor = (userId) => `user:${userId}`;

// מפעיל את Socket.IO על שרת ה-HTTP ומגדיר אימות וחדרים.
export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
  });

  // רץ פעם אחת לכל ניסיון התחברות, לפני 'connection'. קריאה ל-next(error) דוחה את החיבור.
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
    // היציאה מהחדר בזמן ניתוק היא אוטומטית.
  });

  return io;
}

// שולח אירוע לכל החיבורים של משתמש אחד.
export function emitToUser(userId, event, payload) {
  io?.to(roomFor(userId)).emit(event, payload);
}
