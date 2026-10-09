// Builds the Express application: global middleware, then every route under /api.
// (server.js starts it listening; keeping the two apart lets tests import the app alone.)
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

export const app = express();

// ---------- Global middleware (runs on every request, in this order) ----------

app.use(helmet()); // security headers
app.use(compression()); // gzip responses
app.use(cors({ origin: config.corsOrigins, credentials: true })); // let the React dev server call us
app.use(express.json({ limit: '1mb' })); // parse JSON bodies into req.body
app.use(cookieParser()); // parse cookies into req.cookies (the refresh token)
app.use((req, res, next) => {
  // A request id for tracing one request through the logs.
  res.setHeader('x-request-id', req.header('x-request-id') || randomUUID());
  next();
});
// Basic protection against brute force / floods: 120 requests per minute per client.
if (config.rateLimitEnabled) {
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
}

// ---------- Routes ----------

const api = express.Router();

// Public routes (no token needed).
api.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
api.get('/ready', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
});
api.use('/auth', authRouter); // sign-in, sign-up, refresh... (/sessions/revoke-all checks auth itself)

// Everything below requires a valid access token.
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
api.use(commentsRouter); // /tasks/:taskId/comments and /comments/:id
api.use(attachmentsRouter); // /tasks/:taskId/attachments and /attachments/:id

app.use('/api', api);

// ---------- Errors (must be last) ----------

app.use('/api', notFoundHandler);
app.use(errorHandler);
