// תפקיד הקובץ: ניהול הרשאות על ידי מנהל הארגון: שינוי לתפקיד וחריג למשתמש.
// משתמשים בו: permissions.routes.js

// Managing permissions: an Org Admin (anyone with permissions.manage) can
//   - change what a role may do in their organization, and
//   - give a single employee an exception (extra permission / removed permission).
//
// Guard rails, so this can't become a security hole:
//   * platform ('system') permissions can't be changed by an organization at all;
//   * you can only GRANT a permission you have yourself;
//   * you can't change your own exceptions, or those of someone above your role level;
//   * users.manage / permissions.manage can't be taken away from Org Admins (no lock-out);
//   * project-management permissions can only be given to Project Managers - they only work
//     in projects the user manages, so for anyone else they would do nothing;
//   * every change is written to the audit log.
import { prisma } from '../../db.js';
import {
  canGrant,
  EDITABLE_ROLES,
  isChangeable,
  isLockedFor,
  PERMISSION_BY_KEY,
  PERMISSIONS,
  ROLE_DEFAULTS,
} from '../../permissions/catalog.js';
import { explainPermissions, loadPermissionInputs, roleHasPermission } from '../../permissions/effective.js';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { highestRoleLevel, isManager } from '../../utils/permissions.js';
import { recordAudit } from '../audit-log/audit-log.service.js';

const ROLE_LABELS = {
  EMPLOYEE: 'Employee',
  PROJECT_MANAGER: 'Project Manager',
  ORG_ADMIN: 'Organization Administrator',
  SYSTEM_ADMIN: 'System Administrator',
};

// Permissions that only mean something for someone who manages projects.
const needsProjectManager = (key) => key === 'projects.create' || PERMISSION_BY_KEY.get(key)?.scope === 'managed-project';

function requireKnownPermission(key) {
  if (!PERMISSION_BY_KEY.has(key)) throw notFound(`Unknown permission "${key}"`);
  if (!isChangeable(key)) throw forbidden('Platform permissions cannot be changed by an organization');
}

// ---------- The role matrix ----------

// Everything the Roles & Permissions screen needs: the catalog, and for each role whether it
// has each permission in this organization (and whether that's the default or a change).
// מחזיר לכל תפקיד אילו הרשאות יש לו בארגון.
// נקרא מ: permissions.routes.js
export async function getMatrix(actor) {
  const orgChanges = await prisma.organizationRolePermission.findMany({
    where: { organizationId: actor.organizationId },
  });

  return {
    permissions: PERMISSIONS.map((p) => ({
      key: p.key,
      label: p.label,
      description: p.description,
      group: p.group,
      scope: p.scope,
      changeable: isChangeable(p.key),
      lockedFor: p.lockedFor ?? [],
    })),
    roles: Object.keys(ROLE_DEFAULTS).map((roleName) => ({
      name: roleName,
      label: ROLE_LABELS[roleName],
      editable: EDITABLE_ROLES.includes(roleName),
      permissions: PERMISSIONS.map(({ key }) => {
        const { granted, source } = roleHasPermission(roleName, key, orgChanges);
        return { key, granted, source, isDefault: ROLE_DEFAULTS[roleName].includes(key) };
      }),
    })),
  };
}

// granted: true = the role gets it, false = the role loses it, null = back to the default.
// נותן או שולל הרשאה מתפקיד בארגון, או מחזיר לברירת המחדל.
// נקרא מ: permissions.routes.js
export async function setRolePermission(actor, roleName, key, granted) {
  requireKnownPermission(key);
  if (!EDITABLE_ROLES.includes(roleName)) throw forbidden('This role cannot be changed');
  if (granted === false && isLockedFor(key, roleName)) {
    throw forbidden(`"${PERMISSION_BY_KEY.get(key).label}" can't be removed from this role - it would lock administrators out`);
  }
  if (granted === true && !canGrant(actor.permissions, key)) {
    throw forbidden("You can't grant a permission you don't have yourself");
  }

  const where = { organizationId_roleName_permissionKey: { organizationId: actor.organizationId, roleName, permissionKey: key } };
  // Setting a role back to its default is the same as having no change at all.
  if (granted === null || granted === ROLE_DEFAULTS[roleName].includes(key)) {
    await prisma.organizationRolePermission.deleteMany({
      where: { organizationId: actor.organizationId, roleName, permissionKey: key },
    });
  } else {
    await prisma.organizationRolePermission.upsert({
      where,
      update: { granted, updatedById: actor.userId },
      create: { organizationId: actor.organizationId, roleName, permissionKey: key, granted, updatedById: actor.userId },
    });
  }

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'ROLE_PERMISSION_CHANGED',
    entityType: 'Role',
    entityId: roleName,
    metadata: { role: roleName, permission: key, granted: granted ?? 'default' },
  });

  return getMatrix(actor);
}

// ---------- One employee ----------

async function requireTargetUser(actor, userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId, deletedAt: null },
    include: { roles: { include: { role: true } } },
  });
  if (!user) throw notFound('User not found');
  return { ...user, roleNames: user.roles.map((r) => r.role.name) };
}

// A user's effective permissions, with where each one comes from, plus their exceptions.
// מחזיר את ההרשאות של משתמש ומאיפה כל אחת מגיעה.
// נקרא מ: permissions.routes.js
export async function getUserPermissions(actor, userId) {
  const user = await requireTargetUser(actor, userId);
  const inputs = await loadPermissionInputs(actor.organizationId, user.id);
  const overrides = await prisma.userPermissionOverride.findMany({
    where: { userId: user.id },
    include: { grantedBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return {
    user: { id: user.id, firstName: user.firstName, lastName: user.lastName, roles: user.roleNames },
    editable: canEditUser(actor, user) === null,
    notEditableReason: canEditUser(actor, user),
    permissions: explainPermissions(user.roleNames, inputs),
    overrides: overrides.map((o) => ({
      key: o.permissionKey,
      granted: o.granted,
      expiresAt: o.expiresAt,
      expired: Boolean(o.expiresAt && o.expiresAt <= new Date()),
      reason: o.reason,
      grantedBy: o.grantedBy,
      updatedAt: o.updatedAt,
    })),
  };
}

// Returns null when the actor may edit this user's exceptions, otherwise the reason why not.
function canEditUser(actor, user) {
  if (user.id === actor.userId) return "You can't change your own permissions";
  if (highestRoleLevel(user.roleNames) > highestRoleLevel(actor.roles)) {
    return "You can't change the permissions of someone with a higher role than yours";
  }
  return null;
}

// granted: true = extra permission, false = removed permission, null = remove the exception.
// expiresAt (optional) makes the exception temporary.
// קובע או מסיר חריג הרשאה אישי למשתמש.
// נקרא מ: permissions.routes.js
export async function setUserOverride(actor, userId, key, { granted, expiresAt, reason }) {
  requireKnownPermission(key);
  const user = await requireTargetUser(actor, userId);

  const notEditable = canEditUser(actor, user);
  if (notEditable) throw forbidden(notEditable);

  if (granted === true) {
    if (!canGrant(actor.permissions, key)) throw forbidden("You can't grant a permission you don't have yourself");
    if (needsProjectManager(key) && !isManager({ roles: user.roleNames })) {
      throw badRequest(`"${PERMISSION_BY_KEY.get(key).label}" only applies to Project Managers - give ${user.firstName} that role instead`);
    }
  }
  if (granted === false && user.roleNames.some((role) => isLockedFor(key, role))) {
    throw forbidden(`"${PERMISSION_BY_KEY.get(key).label}" can't be removed from an organization administrator`);
  }
  if (expiresAt && expiresAt <= new Date()) throw badRequest('The expiry date must be in the future');

  if (granted === null) {
    await prisma.userPermissionOverride.deleteMany({ where: { userId: user.id, permissionKey: key } });
  } else {
    const data = { granted, expiresAt: expiresAt ?? null, reason: reason?.trim() || null, grantedById: actor.userId };
    await prisma.userPermissionOverride.upsert({
      where: { userId_permissionKey: { userId: user.id, permissionKey: key } },
      update: data,
      create: { ...data, organizationId: actor.organizationId, userId: user.id, permissionKey: key },
    });
  }

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'USER_PERMISSION_CHANGED',
    entityType: 'User',
    entityId: user.id,
    metadata: {
      permission: key,
      granted: granted ?? 'removed exception',
      ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
    },
  });

  return getUserPermissions(actor, user.id);
}
