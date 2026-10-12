// זיהוי המשתמש ובדיקת הרשאה.

import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { PERMISSION_KEYS } from '../permissions/catalog.js';
import { effectivePermissions } from '../permissions/effective.js';
import { forbidden, unauthorized } from '../utils/httpError.js';
import { highestRoleLevel, ROLE_LEVEL } from '../utils/permissions.js';

// טוען את המשתמש המחובר לפי אסימון הגישה. מחזיר את האובייקט שכל
// service מקבל כ-actor:
//   { userId, organizationId, email, roles, permissions }
// permissions הוא Set של מפתחות הרשאה - ברירות המחדל של התפקיד + שינויי הארגון +
// החריגים האישיים של המשתמש (ראו permissions/effective.js).
// משמש גם את ה-middleware של HTTP שלמטה וגם את החיבור של Socket.IO.
// מאמת אסימון גישה, טוען את המשתמש ומחשב את ההרשאות שלו.
// נקרא מ: socket.js
export async function authenticateAccessToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.accessSecret);
  } catch {
    throw unauthorized('Unauthorized');
  }

  // נטען מחדש בכל בקשה, כך שהשעיית משתמש או שינוי בהרשאות שלו חלים
  // מיד, ולא רק כשאסימון הגישה שלו פג.
  const [user, orgChanges] = await Promise.all([
    prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } }, permissionOverrides: true },
    }),
    prisma.organizationRolePermission.findMany({ where: { organizationId: payload.organizationId } }),
  ]);
  if (!user || user.status !== 'ACTIVE' || user.organizationId !== payload.organizationId) {
    throw unauthorized('Account is no longer active');
  }

  const roles = user.roles.map((userRole) => userRole.role.name);
  return {
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    roles,
    permissions: effectivePermissions(roles, { orgChanges, userOverrides: user.permissionOverrides }),
  };
}

// כל נתיב תחת /api עובר כאן, חוץ מהציבוריים (ראו app.js).
// בהצלחה, המשתמש זמין ב-req.user.
// חוסם בקשה בלי אסימון תקף, ושם את המשתמש ב-req.user.
// נקרא מ: app.js, auth.routes.js
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Unauthorized');
  }
  req.user = await authenticateAccessToken(header.slice('Bearer '.length));
  next();
}

// שימוש:  router.get('/', requirePermission('audit.view'), handler)
// להרשאות ברמת הארגון. הרשאות ברמת פרויקט (tasks.manage, ...)
// נבדקות בתוך ה-services, כי הן תלויות גם באיזה פרויקט מדובר
// (ראו assertProjectPermission בקובץ modules/projects/projects.service.js).
// יוצר middleware שמחזיר 403 למי שאין לו את ההרשאה.
// נקרא מ: audit-log.routes.js, automation-rules.routes.js, insights.routes.js, meetings.routes.js +7
export function requirePermission(key) {
  if (!PERMISSION_KEYS.has(key)) throw new Error(`Unknown permission "${key}"`); // תופס שגיאות הקלדה כבר בהפעלת השרת
  return (req, _res, next) => {
    if (!req.user?.permissions.has(key)) {
      throw forbidden('You do not have permission to perform this action');
    }
    next();
  };
}

// שימוש:  router.get('/', requireRole('SYSTEM_ADMIN'), handler)
// מתיר לתפקיד הזה ולכל תפקיד שמעליו (עובד < מנהל פרויקט < מנהל ארגון < מנהל מערכת).
// עדיין בשימוש לדברים שקשורים לתפקיד עצמו ולא להרשאה שאפשר לשנות.
// יוצר middleware שמתיר רק מדרג מסוים ומעלה.
// נקרא מ: הקובץ הזה בלבד
export function requireRole(role) {
  const minLevel = ROLE_LEVEL[role];
  return (req, _res, next) => {
    if (!req.user || highestRoleLevel(req.user.roles) < minLevel) {
      throw forbidden('You do not have permission to perform this action');
    }
    next();
  };
}
