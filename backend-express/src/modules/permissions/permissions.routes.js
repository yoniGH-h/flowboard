// נתיבי ניהול ההרשאות.

import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { isoDate, parse, RoleName } from '../../utils/validate.js';
import * as permissionsService from './permissions.service.js';

// true = לתת, false = לשלול, null = חזרה לברירת המחדל / הסרת החריג
const roleChangeSchema = z.strictObject({ granted: z.boolean().nullable() });

const userOverrideSchema = z.strictObject({
  granted: z.boolean().nullable(),
  expiresAt: isoDate.nullable().optional(),
  reason: z.string().max(200).optional(),
});

// הראוטר של ניהול ההרשאות.
export const permissionsRouter = Router();
permissionsRouter.use(requirePermission('permissions.manage'));

// מחזיר לכל תפקיד אילו הרשאות יש לו בארגון.
permissionsRouter.get('/matrix', async (req, res) => {
  res.json(await permissionsService.getMatrix(req.user));
});

// נותן או שולל הרשאה מתפקיד בארגון, או מחזיר לברירת המחדל.
permissionsRouter.put('/roles/:roleName/:key', async (req, res) => {
  const roleName = parse(RoleName, req.params.roleName);
  const { granted } = parse(roleChangeSchema, req.body);
  res.json(await permissionsService.setRolePermission(req.user, roleName, req.params.key, granted));
});

// מחזיר את ההרשאות של משתמש ומאיפה כל אחת מגיעה.
permissionsRouter.get('/users/:userId', async (req, res) => {
  res.json(await permissionsService.getUserPermissions(req.user, req.params.userId));
});

// קובע או מסיר חריג הרשאה אישי למשתמש.
permissionsRouter.put('/users/:userId/:key', async (req, res) => {
  const dto = parse(userOverrideSchema, req.body);
  res.json(await permissionsService.setUserOverride(req.user, req.params.userId, req.params.key, dto));
});
