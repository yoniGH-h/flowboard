// תפקיד הקובץ: לוגיקת המשתמשים: פרופיל, רשימה, סטטוס, תפקידים והסרה.
// משתמשים בו: users.routes.js

import { prisma } from '../../db.js';
import { forbidden, notFound } from '../../utils/httpError.js';
import { ROLE_LEVEL } from '../../utils/permissions.js';
import { recordAudit } from '../audit-log/audit-log.service.js';

// המבנה הציבורי של משתמש - אף פעם לא כולל את passwordHash או אסימוני איפוס.
const PROFILE_SELECT = {
  id: true,
  organizationId: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarColor: true,
  title: true,
  status: true,
  lastActiveAt: true,
  createdAt: true,
  defaultRole: true,
  roles: { select: { role: { select: { name: true } } } },
};

// { roles: [{ role: { name: 'EMPLOYEE' } }] } -> { roles: ['EMPLOYEE'] }
function toProfile(user) {
  const { roles, ...rest } = user;
  return { ...rest, roles: roles.map((r) => r.role.name) };
}

// שולף משתמש אחד בארגון, עם התפקידים וההרשאות.
// נקרא מ: users.routes.js
export async function findById(userId, organizationId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: PROFILE_SELECT,
  });
  if (!user) throw notFound('User not found');
  return toProfile(user);
}

// מעדכן את פרטי הפרופיל של המשתמש.
// נקרא מ: users.routes.js
export async function updateProfile(userId, dto) {
  // בבורר "התפקיד הפעיל" אפשר לבחור רק תפקיד שהמשתמש באמת מחזיק.
  if (dto.defaultRole) {
    const ownsRole = await prisma.userRole.findFirst({
      where: { userId, role: { name: dto.defaultRole } },
    });
    if (!ownsRole) throw forbidden('You can only select one of your assigned roles');
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: dto,
    select: PROFILE_SELECT,
  });
  return toProfile(user);
}

// שולף את משתמשי הארגון, עם חיפוש ודפדוף.
// נקרא מ: users.routes.js
export async function listForOrganization(organizationId, query) {
  const where = {
    organizationId,
    deletedAt: null,
    status: query.status,
    OR: query.search
      ? [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ]
      : undefined,
  };

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: PROFILE_SELECT,
      orderBy: { createdAt: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { items: users.map(toProfile), total, page: query.page, pageSize: query.pageSize };
}

// משנה סטטוס של משתמש (פעיל או מושעה).
// נקרא מ: users.routes.js
export async function updateStatus(actor, targetUserId, status) {
  const target = await requireSameOrgUser(actor.organizationId, targetUserId);
  if (target.id === actor.userId && status === 'SUSPENDED') {
    throw forbidden('You cannot suspend your own account');
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { status, deletedAt: status === 'ACTIVE' ? null : undefined },
    select: PROFILE_SELECT,
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
    entityType: 'User',
    entityId: target.id,
  });

  return toProfile(updated);
}

// משנה את התפקידים של משתמש.
// נקרא מ: users.routes.js
export async function updateRoles(actor, targetUserId, roleNames) {
  const target = await requireSameOrgUser(actor.organizationId, targetUserId);

  if (roleNames.includes('SYSTEM_ADMIN') && !actor.roles.includes('SYSTEM_ADMIN')) {
    throw forbidden('Only a System Administrator can grant the System Administrator role');
  }

  const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } });

  // שומרים את תפקיד ברירת המחדל הנוכחי של המשתמש אם הוא עדיין מחזיק בו, ואחרת את הגבוה ביותר שלו.
  const defaultRole = roleNames.includes(target.defaultRole)
    ? target.defaultRole
    : [...roleNames].sort((a, b) => ROLE_LEVEL[b] - ROLE_LEVEL[a])[0];

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: target.id } }),
    prisma.userRole.createMany({
      data: roles.map((role) => ({
        userId: target.id,
        roleId: role.id,
        organizationId: actor.organizationId,
      })),
    }),
    prisma.user.update({ where: { id: target.id }, data: { defaultRole } }),
  ]);

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'USER_ROLES_CHANGED',
    entityType: 'User',
    entityId: target.id,
    metadata: { roles: roleNames },
  });

  return findById(target.id, actor.organizationId);
}

// "הסרה" היא מחיקה רכה: החשבון מושעה ומוסתר, וכל החיבורים שלו
// מבוטלים, אבל ההיסטוריה שלו (משימות, תגובות, רשומות ביומן) נשארת.
// מסיר משתמש מהארגון ושומר על ההיסטוריה שלו.
// נקרא מ: users.routes.js
export async function remove(actor, targetUserId) {
  const target = await requireSameOrgUser(actor.organizationId, targetUserId);
  if (target.id === actor.userId) {
    throw forbidden('You cannot remove your own account');
  }

  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: target.id },
      data: { status: 'SUSPENDED', deletedAt: new Date() },
    }),
  ]);

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'USER_REMOVED',
    entityType: 'User',
    entityId: target.id,
  });
}

// הפרדה בין ארגונים: מזהה משתמש מארגון אחר מתנהג כאילו אינו קיים.
async function requireSameOrgUser(organizationId, userId) {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
  if (!user) throw notFound('User not found');
  return user;
}
