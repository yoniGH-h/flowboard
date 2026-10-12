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

// כל מה שכאן דורש permissions.manage (כברירת מחדל מנהלי ארגון).
// הראוטר של ניהול ההרשאות.
// נקרא מ: app.js
export const permissionsRouter = Router();
permissionsRouter.use(requirePermission('permissions.manage'));

// GET /api/permissions/matrix - הקטלוג, וההרשאות של כל תפקיד בארגון הזה.
// מחזיר לכל תפקיד אילו הרשאות יש לו בארגון.
// נקרא מ: fetchPermissionMatrix (api.js)
// קורא ל: permissionsService.getMatrix
permissionsRouter.get('/matrix', async (req, res) => {
  res.json(await permissionsService.getMatrix(req.user));
});

// PUT /api/permissions/roles/:roleName/:key  { granted }
// נותן או שולל הרשאה מתפקיד בארגון, או מחזיר לברירת המחדל.
// נקרא מ: setRolePermission (api.js)
// קורא ל: parse, permissionsService.setRolePermission
permissionsRouter.put('/roles/:roleName/:key', async (req, res) => {
  const roleName = parse(RoleName, req.params.roleName);
  const { granted } = parse(roleChangeSchema, req.body);
  res.json(await permissionsService.setRolePermission(req.user, roleName, req.params.key, granted));
});

// GET /api/permissions/users/:userId - ההרשאות בפועל (ולמה) + החריגים.
// מחזיר את ההרשאות של משתמש ומאיפה כל אחת מגיעה.
// נקרא מ: fetchUserPermissions (api.js)
// קורא ל: permissionsService.getUserPermissions
permissionsRouter.get('/users/:userId', async (req, res) => {
  res.json(await permissionsService.getUserPermissions(req.user, req.params.userId));
});

// PUT /api/permissions/users/:userId/:key  { granted, expiresAt?, reason? }
// קובע או מסיר חריג הרשאה אישי למשתמש.
// נקרא מ: setUserPermission (api.js)
// קורא ל: parse, permissionsService.setUserOverride
permissionsRouter.put('/users/:userId/:key', async (req, res) => {
  const dto = parse(userOverrideSchema, req.body);
  res.json(await permissionsService.setUserOverride(req.user, req.params.userId, req.params.key, dto));
});
