// נתיבי הארגונים.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { requirePermission } from '../../middleware/auth.js';
import { forbidden, notFound } from '../../utils/httpError.js';
import { nonEmptyString, OrganizationStatus, parse } from '../../utils/validate.js';
import { recordAudit } from '../audit-log/audit-log.service.js';

const updateOrganizationSchema = z.strictObject({
  name: nonEmptyString.optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'brandColor must be a hex color, e.g. #2E8A57')
    .optional(),
  tagline: z.string().max(120).optional(),
});

const updateStatusSchema = z.strictObject({ status: OrganizationStatus });

// ---------- לוגיקה ----------

// שולף ארגון עם מספר המשתמשים והפרויקטים.
// נקרא מ: GET /current, PATCH /current, GET /, PATCH /:id/status
// קורא ל: notFound, מסד הנתונים (organization, user, project)
async function withCounts(organizationId) {
  const [organization, memberCount, projectCount] = await prisma.$transaction([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.user.count({ where: { organizationId } }),
    prisma.project.count({ where: { organizationId, archived: false } }),
  ]);
  if (!organization) throw notFound('Organization not found');
  return { ...organization, memberCount, projectCount };
}

// ---------- נתיבים ----------

// הראוטר של הארגונים.
// נקרא מ: app.js
export const organizationsRouter = Router();

// מחזיר את הארגון של המשתמש.
// נקרא מ: hydrateSession (authApi.js)
// קורא ל: withCounts
organizationsRouter.get('/current', async (req, res) => {
  res.json(await withCounts(req.user.organizationId));
});

// מעדכן את הגדרות הארגון.
// נקרא מ: updateOrganization (api.js)
// קורא ל: requirePermission, parse, recordAudit, withCounts, מסד הנתונים (organization)
organizationsRouter.patch('/current', requirePermission('organization.settings.manage'), async (req, res) => {
  const dto = parse(updateOrganizationSchema, req.body);
  const { organizationId, userId } = req.user;

  await prisma.organization.update({ where: { id: organizationId }, data: dto });
  await recordAudit({
    organizationId,
    actorId: userId,
    action: 'ORGANIZATION_SETTINGS_UPDATED',
    entityType: 'Organization',
    entityId: organizationId,
  });

  res.json(await withCounts(organizationId));
});

// מנהל מערכת: כל הארגונים בפלטפורמה.
// מחזיר את כל הארגונים (מנהל מערכת).
// נקרא מ: fetchOrganizations (api.js)
// קורא ל: requirePermission, withCounts, מסד הנתונים (organization)
organizationsRouter.get('/', requirePermission('organizations.manage'), async (_req, res) => {
  const organizations = await prisma.organization.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(await Promise.all(organizations.map((org) => withCounts(org.id))));
});

// משעה או מפעיל ארגון (מנהל מערכת).
// נקרא מ: setOrganizationStatus (api.js)
// קורא ל: requirePermission, parse, forbidden, notFound, recordAudit, withCounts +1
organizationsRouter.patch('/:id/status', requirePermission('organizations.manage'), async (req, res) => {
  const { status } = parse(updateStatusSchema, req.body);
  const organizationId = req.params.id;

  if (status === 'SUSPENDED' && organizationId === req.user.organizationId) {
    throw forbidden('You cannot suspend your own organization');
  }
  if (!(await prisma.organization.findUnique({ where: { id: organizationId } }))) {
    throw notFound('Organization not found');
  }

  await prisma.organization.update({ where: { id: organizationId }, data: { status } });
  await recordAudit({
    organizationId,
    actorId: req.user.userId,
    action: status === 'ACTIVE' ? 'ORGANIZATION_ACTIVATED' : 'ORGANIZATION_SUSPENDED',
    entityType: 'Organization',
    entityId: organizationId,
  });

  res.json(await withCounts(organizationId));
});
