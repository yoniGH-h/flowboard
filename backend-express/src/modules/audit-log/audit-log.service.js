// תפקיד הקובץ: כתיבה וקריאה של יומן הביקורת.
// משתמשים בו: attachments.routes.js, audit-log.routes.js, auth.service.js, comments.routes.js +7

import { prisma } from '../../db.js';

// Appends one row to the organization's audit trail. Every module calls this after a
// significant action. Never put passwords, tokens, or other secrets in `metadata` - Org
// Admins can read audit rows on the Audit Log screen.
// רושם שורה ביומן הביקורת: מי עשה, מה ועל מה.
// נקרא מ: attachments.routes.js, auth.service.js, comments.routes.js, meetings.routes.js +6
export function recordAudit({ organizationId, actorId, action, entityType, entityId, projectId, taskId, metadata }) {
  return prisma.auditLogEntry.create({
    data: {
      organizationId,
      actorId,
      action,
      entityType,
      entityId,
      projectId,
      taskId,
      metadata: metadata ?? {},
    },
  });
}

function buildWhere(filters, organizationId) {
  return {
    organizationId,
    action: filters.action,
    actorId: filters.actorId,
    entityType: filters.entityType,
    OR: filters.search
      ? [
          { action: { contains: filters.search, mode: 'insensitive' } },
          { entityType: { contains: filters.search, mode: 'insensitive' } },
        ]
      : undefined,
  };
}

async function findPage(filters, organizationId, include) {
  const where = buildWhere(filters, organizationId);
  const [items, total] = await prisma.$transaction([
    prisma.auditLogEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: filters.cursor ? 1 : (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      include,
    }),
    prisma.auditLogEntry.count({ where }),
  ]);
  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    nextCursor: items.length === filters.pageSize ? items.at(-1)?.id : null,
  };
}

const ACTOR = { select: { firstName: true, lastName: true, email: true } };

// שולף את רשומות היומן של ארגון אחד, עם סינון.
// נקרא מ: audit-log.routes.js
export function findForOrganization(organizationId, filters) {
  return findPage(filters, organizationId, { actor: ACTOR });
}

// System Administrator scope - no organization filter, and each entry carries its
// organization's name so the cross-org feed stays readable.
// שולף רשומות יומן מכל הארגונים (למנהל מערכת).
// נקרא מ: audit-log.routes.js
export function findAcrossOrganizations(filters) {
  return findPage(filters, undefined, { actor: ACTOR, organization: { select: { name: true } } });
}
