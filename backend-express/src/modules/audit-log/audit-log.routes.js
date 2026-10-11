// תפקיד הקובץ: נתיבי יומן הביקורת: צפייה ברמת הארגון וברמת המערכת.
// משתמשים בו: app.js

import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { paginationShape, parse, uuid } from '../../utils/validate.js';
import * as auditLog from './audit-log.service.js';

const querySchema = z.strictObject({
  ...paginationShape,
  action: z.string().optional(),
  actorId: uuid.optional(),
  entityType: z.string().optional(),
  search: z.string().optional(), // matches action or entity type
});

// הראוטר של יומן הביקורת.
// נקרא מ: app.js
export const auditLogRouter = Router();

// GET /api/audit-log - the caller's organization only.
auditLogRouter.get('/', requirePermission('audit.view'), async (req, res) => {
  const filters = parse(querySchema, req.query);
  res.json(await auditLog.findForOrganization(req.user.organizationId, filters));
});

// GET /api/audit-log/system - every organization (System Activity tab).
auditLogRouter.get('/system', requirePermission('system.audit.view'), async (req, res) => {
  const filters = parse(querySchema, req.query);
  res.json(await auditLog.findAcrossOrganizations(filters));
});
