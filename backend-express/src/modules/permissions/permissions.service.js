// ניהול ההרשאות בארגון.
// חלקים עיקריים: טבלת התפקידים, שינוי הרשאה לתפקיד, הרשאות וחריגים של עובד אחד.

// ניהול הרשאות: מנהל ארגון (כל מי שיש לו permissions.manage) יכול
//   - לשנות מה מותר לתפקיד בארגון שלו, וגם
//   - לתת לעובד יחיד חריג (הרשאה נוספת או שלילת הרשאה).
//
// כללי הגנה, כדי שזה לא יהפוך לפרצת אבטחה:
//   * ארגון לא יכול לשנות הרשאות של הפלטפורמה ('system') בכלל;
//   * אפשר להעניק רק הרשאה שיש לך בעצמך;
//   * אי אפשר לשנות חריגים של עצמך, או של מי שמעליך בדרג;
//   * אי אפשר לשלול ממנהלי ארגון את users.manage ואת permissions.manage (שלא יינעלו בחוץ);
//   * הרשאות של ניהול פרויקט אפשר לתת רק למנהלי פרויקטים - הן פועלות רק
//     בפרויקטים שהמשתמש מנהל, ולכל אחד אחר הן לא היו עושות כלום;
//   * כל שינוי נרשם ביומן הביקורת.
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

// הרשאות שיש להן משמעות רק למי שמנהל פרויקטים.
const needsProjectManager = (key) => key === 'projects.create' || PERMISSION_BY_KEY.get(key)?.scope === 'managed-project';

function requireKnownPermission(key) {
  if (!PERMISSION_BY_KEY.has(key)) throw notFound(`Unknown permission "${key}"`);
  if (!isChangeable(key)) throw forbidden('Platform permissions cannot be changed by an organization');
}

// ---------- טבלת התפקידים ----------

// כל מה שמסך התפקידים וההרשאות צריך: הקטלוג, ולכל תפקיד - האם יש לו
// כל הרשאה בארגון הזה (והאם זו ברירת המחדל או שינוי).
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

// granted: true = התפקיד מקבל, false = התפקיד מאבד, null = חזרה לברירת המחדל.
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
  // החזרת תפקיד לברירת המחדל זהה למצב שבו אין שינוי בכלל.
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

// ---------- עובד אחד ----------

async function requireTargetUser(actor, userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId, deletedAt: null },
    include: { roles: { include: { role: true } } },
  });
  if (!user) throw notFound('User not found');
  return { ...user, roleNames: user.roles.map((r) => r.role.name) };
}

// ההרשאות בפועל של משתמש, מאיפה כל אחת מגיעה, והחריגים שלו.
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

// מחזיר null כשלמשתמש מותר לערוך את החריגים של המשתמש הזה, ואחרת את הסיבה שלא.
function canEditUser(actor, user) {
  if (user.id === actor.userId) return "You can't change your own permissions";
  if (highestRoleLevel(user.roleNames) > highestRoleLevel(actor.roles)) {
    return "You can't change the permissions of someone with a higher role than yours";
  }
  return null;
}

// granted: true = הרשאה נוספת, false = שלילת הרשאה, null = הסרת החריג.
// expiresAt (אופציונלי) הופך את החריג לזמני.
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
