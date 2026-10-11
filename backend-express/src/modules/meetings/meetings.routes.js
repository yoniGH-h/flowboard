// תפקיד הקובץ: נתיב פתיחת שיחה קולית או פגישת Zoom עם חבר צוות.
// משתמשים בו: app.js

import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { badRequest, HttpError, notFound } from '../../utils/httpError.js';
import { parse, uuid } from '../../utils/validate.js';
import { recordAudit } from '../audit-log/audit-log.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import { assertAccessible } from '../projects/projects.service.js';
import { requireTaskInOrg } from '../tasks/tasks.service.js';
import { createInstantMeeting, isZoomConfigured } from './zoom.js';

const startMeetingSchema = z.strictObject({
  inviteeId: uuid,
  mode: z.enum(['voice', 'video']), // voice = פגישת Zoom עם מצלמות כבויות
  projectId: uuid.optional(), // מאיפה נפתחה השיחה (להקשר ולבדיקות גישה)
  taskId: uuid.optional(),
});

// יצירת פגישות Zoom צורכת מכסת API - כמה שיחות בדקה לכל לקוח מספיקות בהחלט.
const meetingLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

// הראוטר של הפגישות.
// נקרא מ: app.js
export const meetingsRouter = Router();

// POST /api/meetings - פתיחת שיחה קולית או פגישת Zoom עם חבר צוות.
// הפותח מקבל { startUrl, joinUrl } ופותח את startUrl (נכנס כמארח); המוזמן מקבל
// בזמן אמת התראת MEETING_INVITE, שהכפתור "Join call" שלה פותח את joinUrl.
meetingsRouter.post('/', requirePermission('calls.start'), meetingLimit, async (req, res) => {
  const dto = parse(startMeetingSchema, req.body);
  const actor = req.user;

  if (!isZoomConfigured()) {
    throw new HttpError(503, 'Zoom is not set up on the server yet (ZOOM_* settings in backend-express/.env).');
  }
  if (dto.inviteeId === actor.userId) throw badRequest('You cannot call yourself');

  // המוזמן חייב להיות משתמש פעיל בארגון של הפותח.
  const invitee = await prisma.user.findFirst({
    where: { id: dto.inviteeId, organizationId: actor.organizationId, status: 'ACTIVE', deletedAt: null },
  });
  if (!invitee) throw notFound('User not found in your organization');

  // כשהשיחה נפתחת ממשימה או מפרויקט, שני האנשים חייבים להיות חברים בפרויקט.
  let projectId = dto.projectId;
  let task = null;
  if (dto.taskId) {
    task = await requireTaskInOrg(actor, dto.taskId);
    projectId = task.projectId;
  }
  if (projectId) {
    const project = await assertAccessible(actor, projectId);
    if (!project.members.some((m) => m.userId === invitee.id) && project.managerId !== invitee.id) {
      throw badRequest(`${invitee.firstName} is not a member of this project`);
    }
  }

  const caller = await prisma.user.findUnique({ where: { id: actor.userId } });
  const callerName = `${caller.firstName} ${caller.lastName}`;
  const kind = dto.mode === 'voice' ? 'Voice call' : 'Zoom meeting';

  const meeting = await createInstantMeeting({
    topic: task ? `${kind}: ${task.title}` : `${kind} - ${callerName} & ${invitee.firstName} ${invitee.lastName}`,
    mode: dto.mode,
  });

  await createNotification({
    organizationId: actor.organizationId,
    userId: invitee.id,
    type: 'MEETING_INVITE',
    title: `${kind} from ${callerName}`,
    body: task ? `${callerName} is calling you about "${task.title}".` : `${callerName} is calling you.`,
    relatedProjectId: projectId,
    relatedTaskId: task?.id,
    actionUrl: meeting.joinUrl,
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'MEETING_STARTED',
    entityType: 'User',
    entityId: invitee.id,
    projectId,
    taskId: task?.id,
    metadata: { mode: dto.mode, zoomMeetingId: String(meeting.id) },
  });

  res.status(201).json({ startUrl: meeting.startUrl, joinUrl: meeting.joinUrl });
});
