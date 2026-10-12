// נתיבי יומן הביקורת.

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
  search: z.string().optional(), // מתאים לפעולה או לסוג הישות
});

// הראוטר של יומן הביקורת.
// נקרא מ: app.js
export const auditLogRouter = Router();

// GET /api/audit-log - רק הארגון של המשתמש.
// שולף את רשומות היומן של ארגון אחד, עם סינון.
// נקרא מ: fetchAuditLog (api.js)
// קורא ל: requirePermission, parse, auditLog.findForOrganization
auditLogRouter.get('/', requirePermission('audit.view'), async (req, res) => {
  const filters = parse(querySchema, req.query);
  res.json(await auditLog.findForOrganization(req.user.organizationId, filters));
});

// GET /api/audit-log/system - כל הארגונים (הלשונית System Activity).
// שולף רשומות יומן מכל הארגונים (למנהל מערכת).
// נקרא מ: fetchSystemAuditLog (api.js)
// קורא ל: requirePermission, parse, auditLog.findAcrossOrganizations
auditLogRouter.get('/system', requirePermission('system.audit.view'), async (req, res) => {
  const filters = parse(querySchema, req.query);
  res.json(await auditLog.findAcrossOrganizations(filters));
});
