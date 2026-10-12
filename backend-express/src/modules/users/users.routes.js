// נתיבי המשתמשים.

import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { nonEmptyString, paginationShape, parse, RoleName, UserStatus } from '../../utils/validate.js';
import * as usersService from './users.service.js';

const updateProfileSchema = z.strictObject({
  firstName: nonEmptyString.optional(),
  lastName: nonEmptyString.optional(),
  title: nonEmptyString.optional(),
  avatarColor: z.string().optional(),
  defaultRole: RoleName.optional(),
});

const queryUsersSchema = z.strictObject({
  ...paginationShape,
  search: z.string().optional(), // שם פרטי, שם משפחה או אימייל
  status: UserStatus.optional(),
});

const updateStatusSchema = z.strictObject({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

const updateRolesSchema = z.strictObject({
  roles: z.array(RoleName).min(1),
});

// הראוטר של המשתמשים.
// נקרא מ: app.js
export const usersRouter = Router();

// כולל את permissions - מפתחות ההרשאה בפועל (ברירות המחדל של התפקיד + שינויי
// הארגון + חריגים אישיים) - כדי שהאתר יציג רק מה שמותר למשתמש.
// שולף משתמש אחד בארגון, עם התפקידים וההרשאות.
// נקרא מ: hydrateSession (authApi.js)
// קורא ל: usersService.findById
usersRouter.get('/me', async (req, res) => {
  const me = await usersService.findById(req.user.userId, req.user.organizationId);
  res.json({ ...me, permissions: [...req.user.permissions].sort() });
});

// מעדכן את פרטי הפרופיל של המשתמש.
// נקרא מ: updateUserProfile (api.js)
// קורא ל: usersService.updateProfile, parse
usersRouter.patch('/me', async (req, res) => {
  const me = await usersService.updateProfile(req.user.userId, parse(updateProfileSchema, req.body));
  res.json({ ...me, permissions: [...req.user.permissions].sort() });
});

// כל חבר בארגון יכול לראות את רשימת חברי הצוות (כדי להציג שמות ואווטארים של אחראים ומנהלים);
// הפעולות שמתחת דורשות users.manage.
// שולף את משתמשי הארגון, עם חיפוש ודפדוף.
// נקרא מ: fetchUsers (api.js)
// קורא ל: usersService.listForOrganization, parse
usersRouter.get('/', async (req, res) => {
  res.json(await usersService.listForOrganization(req.user.organizationId, parse(queryUsersSchema, req.query)));
});

// משנה סטטוס של משתמש (פעיל או מושעה).
// נקרא מ: setUserStatus (api.js)
// קורא ל: requirePermission, parse, usersService.updateStatus
usersRouter.patch('/:id/status', requirePermission('users.manage'), async (req, res) => {
  const { status } = parse(updateStatusSchema, req.body);
  res.json(await usersService.updateStatus(req.user, req.params.id, status));
});

// משנה את התפקידים של משתמש.
// נקרא מ: updateUserRoles (api.js)
// קורא ל: requirePermission, parse, usersService.updateRoles
usersRouter.patch('/:id/roles', requirePermission('users.manage'), async (req, res) => {
  const { roles } = parse(updateRolesSchema, req.body);
  res.json(await usersService.updateRoles(req.user, req.params.id, roles));
});

// מסיר משתמש מהארגון ושומר על ההיסטוריה שלו.
// נקרא מ: removeUser (api.js)
// קורא ל: requirePermission, usersService.remove
usersRouter.delete('/:id', requirePermission('users.manage'), async (req, res) => {
  await usersService.remove(req.user, req.params.id);
  res.status(204).end();
});
