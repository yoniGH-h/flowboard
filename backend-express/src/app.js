// בניית אפליקציית Express: middleware ונתיבים.

// בונה את אפליקציית Express: קודם ה-middleware הכללי, ואחריו כל הנתיבים תחת /api.
// (server.js מפעיל את ההאזנה; ההפרדה מאפשרת לבדיקות לייבא רק את האפליקציה.)
import { randomUUID } from 'node:crypto';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config.js';
import { prisma } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { attachmentsRouter } from './modules/attachments/attachments.routes.js';
import { auditLogRouter } from './modules/audit-log/audit-log.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { automationRulesRouter } from './modules/automation-rules/automation-rules.routes.js';
import { commentsRouter } from './modules/comments/comments.routes.js';
import { insightsRouter } from './modules/insights/insights.routes.js';
import { labelsRouter } from './modules/labels/labels.routes.js';
import { meetingsRouter } from './modules/meetings/meetings.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { organizationsRouter } from './modules/organizations/organizations.routes.js';
import { permissionsRouter } from './modules/permissions/permissions.routes.js';
import { planningRouter } from './modules/planning/planning.routes.js';
import { projectsRouter } from './modules/projects/projects.routes.js';
import { rolesRouter } from './modules/roles/roles.routes.js';
import { tasksRouter } from './modules/tasks/tasks.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

// אפליקציית Express המוכנה, עם כל ה-middleware והנתיבים.
// נקרא מ: server.js
export const app = express();

// ---------- middleware כללי (רץ על כל בקשה, בסדר הזה) ----------

app.use(helmet()); // כותרות אבטחה
app.use(compression()); // דחיסת התשובות (gzip)
app.use(cors({ origin: config.corsOrigins, credentials: true })); // מתיר לאתר (שרת הפיתוח של React) לפנות אלינו
app.use(express.json({ limit: '1mb' })); // מפענח גוף JSON אל req.body
app.use(cookieParser()); // מפענח עוגיות אל req.cookies (אסימון הרענון)
app.use((req, res, next) => {
  // מזהה בקשה, כדי לעקוב אחרי בקשה אחת בלוגים.
  res.setHeader('x-request-id', req.header('x-request-id') || randomUUID());
  next();
});
// הגנה בסיסית מפני ניחוש סיסמאות והצפה: 120 בקשות בדקה לכל לקוח.
if (config.rateLimitEnabled) {
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
}

// ---------- נתיבים ----------

const api = express.Router();

// נתיבים ציבוריים (בלי אסימון).
// בדיקה שהשרת חי.
// נקרא מ: אין קריאה מהאתר
// קורא ל: —
api.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// בדיקה שהשרת מחובר למסד הנתונים.
// נקרא מ: אין קריאה מהאתר
// קורא ל: —
api.get('/ready', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
});
api.use('/auth', authRouter); // כניסה, הרשמה, רענון... (/sessions/revoke-all בודק התחברות בעצמו)

// כל מה שמכאן ומטה דורש אסימון גישה תקף.
api.use(requireAuth);
api.use('/users', usersRouter);
api.use('/organizations', organizationsRouter);
api.use('/roles', rolesRouter);
api.use('/labels', labelsRouter);
api.use('/projects', projectsRouter);
api.use('/tasks', tasksRouter);
api.use('/notifications', notificationsRouter);
api.use('/automation-rules', automationRulesRouter);
api.use('/audit-log', auditLogRouter);
api.use('/meetings', meetingsRouter);
api.use('/permissions', permissionsRouter);
api.use('/insights', insightsRouter);
api.use('/planning', planningRouter);
api.use(commentsRouter); // /tasks/:taskId/comments וגם /comments/:id
api.use(attachmentsRouter); // /tasks/:taskId/attachments וגם /attachments/:id

app.use('/api', api);

// ---------- שגיאות (חייב להיות אחרון) ----------

app.use('/api', notFoundHandler);
app.use(errorHandler);
