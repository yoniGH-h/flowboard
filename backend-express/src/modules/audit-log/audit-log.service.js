import { prisma } from '../../db.js';

// Appends one row to the organization's audit trail. Every module calls this after a
// significant action. Never put passwords, tokens, or other secrets in `metadata` - Org
// Admins can read audit rows on the Audit Log screen.
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

export function findForOrganization(organizationId, filters) {
  return findPage(filters, organizationId, { actor: ACTOR });
}

// System Administrator scope - no organization filter, and each entry carries its
// organization's name so the cross-org feed stays readable.
export function findAcrossOrganizations(filters) {
  return findPage(filters, undefined, { actor: ACTOR, organization: { select: { name: true } } });
}
