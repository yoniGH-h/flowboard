// חישוב ההרשאות בפועל, בשלוש שכבות.

// הרשאות בפועל = מה שמותר למשתמש באמת לעשות, בשלוש שכבות:
//
//   1. ברירות המחדל של התפקיד  (ROLE_DEFAULTS בקובץ catalog.js - איחוד של כל תפקידי המשתמש)
//   2. שינויי הארגון            (OrganizationRolePermission: "אצלנו עובדים רשאים גם X")
//   3. חריגים אישיים            (UserPermissionOverride: "דנה רשאית גם X" / "יוסי לא רשאי Y")
//
// השכבות המאוחרות גוברות. חריגים שפג תוקפם לא נחשבים. הרשאות 'system' (ברמת הפלטפורמה)
// מגיעות רק מהתפקיד SYSTEM_ADMIN - ארגון לא יכול לתת או לשלול אותן.
import { prisma } from '../db.js';
import { EDITABLE_ROLES, PERMISSIONS, ROLE_DEFAULTS } from './catalog.js';

// טוען את כל מה שצריך כדי לחשב את ההרשאות של משתמש אחד (2 שאילתות קטנות).
// טוען מהמסד את שינויי הארגון ואת החריגים של משתמש.
// נקרא מ: permissions.service.js
export async function loadPermissionInputs(organizationId, userId) {
  const [orgChanges, userOverrides] = await Promise.all([
    prisma.organizationRolePermission.findMany({ where: { organizationId } }),
    prisma.userPermissionOverride.findMany({ where: { userId } }),
  ]);
  return { orgChanges, userOverrides };
}

const isActive = (override, now) => !override.expiresAt || override.expiresAt > now;

// האם לתפקיד הזה יש את ההרשאה הזו בארגון הזה (שכבות 1 + 2)?
// מחזיר { granted, source: 'role' | 'organization' }.
// האם לתפקיד יש את ההרשאה בארגון הזה, ומאיזה מקור.
// נקרא מ: permissions.service.js
export function roleHasPermission(roleName, key, orgChanges) {
  const change = EDITABLE_ROLES.includes(roleName)
    ? orgChanges.find((c) => c.roleName === roleName && c.permissionKey === key)
    : undefined;
  if (change) return { granted: change.granted, source: 'organization' };
  return { granted: ROLE_DEFAULTS[roleName]?.includes(key) ?? false, source: 'role' };
}

// ההסבר המלא לכל הרשאה בקטלוג - משמש את מסך ההרשאות
// ("למה דנה רשאית לעשות את זה?"). כל רשומה: { key, granted, source, expiresAt?, reason? }
//   source: 'role' | 'organization' | 'user'
// מחזיר לכל הרשאה אם ניתנה ומאיזו שכבה.
// נקרא מ: permissions.service.js
export function explainPermissions(roles, { orgChanges, userOverrides }, now = new Date()) {
  return PERMISSIONS.map(({ key, scope }) => {
    // שכבות 1 + 2: ניתנת אם לאחד מתפקידי המשתמש יש אותה.
    const perRole = roles.map((role) => roleHasPermission(role, key, orgChanges));
    const fromRole = perRole.find((r) => r.granted);
    let result = fromRole
      ? { key, granted: true, source: fromRole.source }
      : { key, granted: false, source: perRole.some((r) => r.source === 'organization') ? 'organization' : 'role' };

    // שכבה 3: חריג אישי (אף פעם לא להרשאות ברמת הפלטפורמה).
    const override = scope === 'system' ? undefined : userOverrides.find((o) => o.permissionKey === key);
    if (override && isActive(override, now)) {
      result = {
        key,
        granted: override.granted,
        source: 'user',
        expiresAt: override.expiresAt,
        reason: override.reason,
        roleGranted: Boolean(fromRole), // מה היה למשתמש בלי החריג
      };
    }
    return result;
  });
}

// רק קבוצת מפתחות ההרשאה שיש למשתמש - מה שכל בקשה נבדקת מולו.
// מחזיר את קבוצת מפתחות ההרשאה שיש למשתמש.
// נקרא מ: auth.js
export function effectivePermissions(roles, inputs, now = new Date()) {
  return new Set(
    explainPermissions(roles, inputs, now)
      .filter((p) => p.granted)
      .map((p) => p.key),
  );
}
