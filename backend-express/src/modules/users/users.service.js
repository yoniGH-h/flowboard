import { prisma } from '../../db.js';
import { forbidden, notFound } from '../../utils/httpError.js';
import { ROLE_LEVEL } from '../../utils/permissions.js';
import { recordAudit } from '../audit-log/audit-log.service.js';

// The public shape of a user - never includes passwordHash or reset tokens.
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

export async function findById(userId, organizationId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: PROFILE_SELECT,
  });
  if (!user) throw notFound('User not found');
  return toProfile(user);
}

export async function updateProfile(userId, dto) {
  // The "active role" picker can only select a role the user actually holds.
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

export async function updateRoles(actor, targetUserId, roleNames) {
  const target = await requireSameOrgUser(actor.organizationId, targetUserId);

  if (roleNames.includes('SYSTEM_ADMIN') && !actor.roles.includes('SYSTEM_ADMIN')) {
    throw forbidden('Only a System Administrator can grant the System Administrator role');
  }

  const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } });

  // Keep the user's current default role if they still hold it, otherwise use their highest.
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

// "Remove" is a soft delete: the account is suspended and hidden, and all its sessions are
// revoked, but its history (tasks, comments, audit entries) stays intact.
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

// Multi-tenant isolation: a user id from another organization behaves as if it didn't exist.
async function requireSameOrgUser(organizationId, userId) {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
  if (!user) throw notFound('User not found');
  return user;
}
