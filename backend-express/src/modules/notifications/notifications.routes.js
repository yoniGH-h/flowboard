// נתיבי ההתראות.

import { Router } from 'express';
import * as notificationsService from './notifications.service.js';

// הראוטר של ההתראות.
export const notificationsRouter = Router();

// שולף את ההתראות של משתמש.
notificationsRouter.get('/', async (req, res) => {
  res.json(await notificationsService.findForUser(req.user.userId));
});

// מסמן את כל ההתראות של המשתמש כנקראו.
notificationsRouter.patch('/read-all', async (req, res) => {
  res.json(await notificationsService.markAllRead(req.user));
});

// מסמן התראה אחת כנקראה.
notificationsRouter.patch('/:id/read', async (req, res) => {
  res.json(await notificationsService.markRead(req.user, req.params.id));
});
