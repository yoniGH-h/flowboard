// כתיבה וקריאה של יומן הביקורת.

import { prisma } from '../../db.js';

// מוסיף שורה אחת ליומן הביקורת של הארגון. כל מודול קורא לזה אחרי
// פעולה משמעותית. לעולם לא שמים סיסמאות, אסימונים או סודות אחרים ב-metadata -
// מנהלי ארגון יכולים לקרוא את השורות במסך יומן הביקורת.
// רושם שורה ביומן הביקורת: מי עשה, מה ועל מה.
// נקרא מ: attachments.routes.js, auth.service.js, comments.routes.js, meetings.routes.js +6
// קורא ל: מסד הנתונים (auditLogEntry)
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

// בונה את תנאי הסינון של היומן.
// נקרא מ: findPage
// קורא ל: —
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

// שולף עמוד אחד של רשומות יומן.
// נקרא מ: findForOrganization, findAcrossOrganizations
// קורא ל: buildWhere, מסד הנתונים (auditLogEntry)
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
// קורא ל: findPage
export function findForOrganization(organizationId, filters) {
  return findPage(filters, organizationId, { actor: ACTOR });
}

// היקף של מנהל מערכת - בלי סינון לפי ארגון, וכל רשומה נושאת את שם
// הארגון שלה כדי שהרשימה המשולבת תהיה קריאה.
// שולף רשומות יומן מכל הארגונים (למנהל מערכת).
// נקרא מ: audit-log.routes.js
// קורא ל: findPage
export function findAcrossOrganizations(filters) {
  return findPage(filters, undefined, { actor: ACTOR, organization: { select: { name: true } } });
}
