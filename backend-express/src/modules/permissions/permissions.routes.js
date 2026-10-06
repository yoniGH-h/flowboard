import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { isoDate, parse, RoleName } from '../../utils/validate.js';
import * as permissionsService from './permissions.service.js';

// true = grant, false = remove, null = back to the default / remove the exception
const roleChangeSchema = z.strictObject({ granted: z.boolean().nullable() });

const userOverrideSchema = z.strictObject({
  granted: z.boolean().nullable(),
  expiresAt: isoDate.nullable().optional(),
  reason: z.string().max(200).optional(),
});

// Everything here needs permissions.manage (Org Admins by default).
export const permissionsRouter = Router();
permissionsRouter.use(requirePermission('permissions.manage'));

// GET /api/permissions/matrix - the catalog and every role's permissions in this organization.
permissionsRouter.get('/matrix', async (req, res) => {
  res.json(await permissionsService.getMatrix(req.user));
});

// PUT /api/permissions/roles/:roleName/:key  { granted }
permissionsRouter.put('/roles/:roleName/:key', async (req, res) => {
  const roleName = parse(RoleName, req.params.roleName);
  const { granted } = parse(roleChangeSchema, req.body);
  res.json(await permissionsService.setRolePermission(req.user, roleName, req.params.key, granted));
});

// GET /api/permissions/users/:userId - effective permissions (and why) + exceptions.
permissionsRouter.get('/users/:userId', async (req, res) => {
  res.json(await permissionsService.getUserPermissions(req.user, req.params.userId));
});

// PUT /api/permissions/users/:userId/:key  { granted, expiresAt?, reason? }
permissionsRouter.put('/users/:userId/:key', async (req, res) => {
  const dto = parse(userOverrideSchema, req.body);
  res.json(await permissionsService.setUserOverride(req.user, req.params.userId, req.params.key, dto));
});
