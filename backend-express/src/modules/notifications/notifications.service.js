import { prisma } from '../../db.js';
import { emitToUser } from '../../realtime/socket.js';
import { forbidden, notFound } from '../../utils/httpError.js';

// The single place that creates notifications - every module goes through this (never
// prisma.notification.create directly), so saving to the database and the real-time push to
// the browser can never drift apart.
//
// input: { organizationId, userId, type, title, body, relatedProjectId?, relatedTaskId? }
export async function createNotification(input) {
  const notification = await prisma.notification.create({ data: input });
  emitToUser(input.userId, 'notification:new', notification);
  return notification;
}

export function findForUser(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

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

export async function markAllRead(actor) {
  await prisma.notification.updateMany({
    where: { userId: actor.userId, read: false },
    data: { read: true },
  });
  emitToUser(actor.userId, 'notification:read-all', {});
  return true;
}
