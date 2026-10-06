import { io } from 'socket.io-client';
import { getAccessToken } from '../api/session';

// Real-time notifications: the Express API pushes them over Socket.IO. The connection is
// wrapped in a small interface - on / off / start / stop - used by useNotificationsSocket.

// The Socket.IO endpoint lives on the API server's own origin (not under the /api HTTP
// prefix), so strip that off the same VITE_API_URL the REST client uses rather than needing a
// second env var. With VITE_API_URL=/api this is '' - i.e. same-origin.
const SERVER_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/api\/?$/, '');

// A fresh connection per call, so React StrictMode's mount -> unmount -> mount cycle never
// reuses a socket that is still closing. The token is read on every (re)connect, so a
// refreshed access token is picked up automatically after a dropped connection.
export function createNotificationsConnection() {
  const socket = io(SERVER_BASE || undefined, {
    autoConnect: false,
    // A function, so every reconnect sends the current token.
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
