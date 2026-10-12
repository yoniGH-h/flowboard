// נתיבי ההתראות.

import { Router } from 'express';
import * as notificationsService from './notifications.service.js';

// הראוטר של ההתראות.
// נקרא מ: app.js
export const notificationsRouter = Router();

// שולף את ההתראות של משתמש.
// נקרא מ: fetchNotifications (api.js)
// קורא ל: notificationsService.findForUser
notificationsRouter.get('/', async (req, res) => {
  res.json(await notificationsService.findForUser(req.user.userId));
});

// Express מתאים נתיבים לפי סדר ההגדרה, ולכן כתובות קבועות באות לפני כתובות עם :id.
// מסמן את כל ההתראות של המשתמש כנקראו.
// נקרא מ: markAllNotificationsRead (api.js)
// קורא ל: notificationsService.markAllRead
notificationsRouter.patch('/read-all', async (req, res) => {
  res.json(await notificationsService.markAllRead(req.user));
});

// מסמן התראה אחת כנקראה.
// נקרא מ: markNotificationRead (api.js)
// קורא ל: notificationsService.markRead
notificationsRouter.patch('/:id/read', async (req, res) => {
  res.json(await notificationsService.markRead(req.user, req.params.id));
});
