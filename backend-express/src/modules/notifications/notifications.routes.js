// נתיבי ההתראות.

import { Router } from 'express';
import * as notificationsService from './notifications.service.js';

// הראוטר של ההתראות.
// נקרא מ: app.js
export const notificationsRouter = Router();

notificationsRouter.get('/', async (req, res) => {
  res.json(await notificationsService.findForUser(req.user.userId));
});

// Express מתאים נתיבים לפי סדר ההגדרה, ולכן כתובות קבועות באות לפני כתובות עם :id.
notificationsRouter.patch('/read-all', async (req, res) => {
  res.json(await notificationsService.markAllRead(req.user));
});

notificationsRouter.patch('/:id/read', async (req, res) => {
  res.json(await notificationsService.markRead(req.user, req.params.id));
});
