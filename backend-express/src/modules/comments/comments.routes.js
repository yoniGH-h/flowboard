// נתיבי התגובות.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { forbidden, notFound } from '../../utils/httpError.js';
import { nonEmptyString, parse } from '../../utils/validate.js';
import { recordAudit } from '../audit-log/audit-log.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import { assertAccessible, assertProjectPermission } from '../projects/projects.service.js';

const commentSchema = z.strictObject({ body: nonEmptyString });

const AUTHOR = { select: { id: true, firstName: true, lastName: true, avatarColor: true } };

// ---------- פונקציות עזר ----------

// המשימה חייבת להיות בארגון של המשתמש ובפרויקט שיש לו גישה אליו - וכשניתן
// permission, חייבת להיות לו ההרשאה הזו בפרויקט של המשימה.
async function requireAccessibleTask(actor, taskId, permission) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { organizationId: actor.organizationId } },
  });
  if (!task) throw notFound('Task not found');
  if (permission) await assertProjectPermission(actor, task.projectId, permission);
  else await assertAccessible(actor, task.projectId);
  return task;
}

async function requireAccessibleComment(actor, commentId) {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, task: { project: { organizationId: actor.organizationId } } },
    include: { task: true },
  });
  if (!comment) throw notFound('Comment not found');
  const project = await assertAccessible(actor, comment.task.projectId);
  return { ...comment, canModerate: project.can('content.moderate') };
}

// ---------- נתיבים ----------
// מחוברים תחת /api, כי התגובות נמצאות תחת שתי כתובות:
//   /api/tasks/:taskId/comments   (רשימה, יצירה)
//   /api/comments/:id             (עריכה, מחיקה)

// הראוטר של התגובות.
// נקרא מ: app.js
export const commentsRouter = Router();

commentsRouter.get('/tasks/:taskId/comments', async (req, res) => {
  await requireAccessibleTask(req.user, req.params.taskId);
  res.json(
    await prisma.comment.findMany({
      where: { taskId: req.params.taskId },
      orderBy: { createdAt: 'asc' },
      include: { author: AUTHOR },
    }),
  );
});

commentsRouter.post('/tasks/:taskId/comments', async (req, res) => {
  const { body } = parse(commentSchema, req.body);
  const actor = req.user;
  const taskId = req.params.taskId;
  const task = await requireAccessibleTask(actor, taskId, 'comments.create');

  const comment = await prisma.comment.create({
    data: { taskId, authorId: actor.userId, body },
    include: { author: AUTHOR },
  });

  await prisma.activityEntry.create({
    data: { taskId, actorId: actor.userId, action: 'COMMENT_ADDED', detail: 'Added a comment' },
  });
  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'COMMENT_ADDED',
    entityType: 'Comment',
    entityId: comment.id,
    projectId: task.projectId,
    taskId,
  });

  // מתריעים לאחראי על המשימה וליוצר שלה (פעם אחת לכל אחד, ואף פעם לא למי שכתב את התגובה).
  const notifyIds = new Set([task.assigneeId, task.creatorId].filter((id) => id && id !== actor.userId));
  for (const userId of notifyIds) {
    await createNotification({
      organizationId: actor.organizationId,
      userId,
      type: 'COMMENT_ADDED',
      title: 'New comment',
      body: `${comment.author.firstName} ${comment.author.lastName} commented on "${task.title}".`,
      relatedProjectId: task.projectId,
      relatedTaskId: taskId,
    });
  }

  res.status(201).json(comment);
});

// רק מי שכתב את התגובה רשאי לערוך אותה.
commentsRouter.patch('/comments/:id', async (req, res) => {
  const { body } = parse(commentSchema, req.body);
  const comment = await requireAccessibleComment(req.user, req.params.id);
  if (comment.authorId !== req.user.userId) {
    throw forbidden('You can only edit your own comments');
  }

  res.json(
    await prisma.comment.update({
      where: { id: comment.id },
      data: { body, editedAt: new Date() },
      include: { author: AUTHOR },
    }),
  );
});

// מי שכתב את התגובה, או מנהל הפרויקט (מודרציה), רשאים למחוק אותה.
commentsRouter.delete('/comments/:id', async (req, res) => {
  const comment = await requireAccessibleComment(req.user, req.params.id);
  if (comment.authorId !== req.user.userId && !comment.canModerate) {
    throw forbidden('You can only delete your own comments');
  }

  await prisma.comment.delete({ where: { id: comment.id } });
  res.status(204).end();
});
