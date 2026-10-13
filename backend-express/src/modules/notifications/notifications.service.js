// יצירת התראות ושליחתן בזמן אמת.

import { afterCommit, prisma } from '../../db.js';
import { emitToUser } from '../../realtime/socket.js';
import { forbidden, notFound } from '../../utils/httpError.js';

// שומר התראה במסד ושולח אותה למשתמש ב-Socket.IO.
export async function createNotification(input) {
  const notification = await prisma.notification.create({ data: input });
  // בתוך טרנזקציה (למשל ביצוע החלטה) השליחה מחכה עד שהנתונים נשמרו,
  // כך שאף אחד לא מקבל הודעה על שינוי שבוטל אחר כך.
  afterCommit(() => emitToUser(input.userId, 'notification:new', notification));
  return notification;
}

// שולף את ההתראות של משתמש.
export function findForUser(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

// מסמן התראה אחת כנקראה.
export async function markRead(actor, notificationId) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) throw notFound('Notification not found');
  if (notification.userId !== actor.userId) {
    throw forbidden('This notification does not belong to you');
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
  emitToUser(actor.userId, 'notification:read', { id: updated.id });
  return updated;
}

// מסמן את כל ההתראות של המשתמש כנקראו.
export async function markAllRead(actor) {
  await prisma.notification.updateMany({
    where: { userId: actor.userId, read: false },
    data: { read: true },
  });
  emitToUser(actor.userId, 'notification:read-all', {});
  return true;
}
