// תפקיד הקובץ: בדיקת קלט עם zod: הפונקציה parse וסוגי שדות משותפים.
// משתמשים בו: audit-log.routes.js, auth.routes.js, automation-rules.routes.js, comments.routes.js +8

// Request validation with zod. Every route parses its input explicitly:
//
//   const dto = parse(createTaskSchema, req.body);
//
// Schemas are "strict", so unknown fields are rejected (400) instead of silently ignored -
// the same rule the NestJS version enforced with `forbidNonWhitelisted`.
import { z } from 'zod';
import { badRequest } from './httpError.js';

// בודק קלט מול סכמה; זורק 400 עם פירוט אם לא תקין.
// נקרא מ: audit-log.routes.js, auth.routes.js, automation-rules.routes.js, comments.routes.js +8
export function parse(schema, input) {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    const messages = result.error.issues.map((issue) =>
      issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    );
    throw badRequest(messages);
  }
  return result.data;
}

// ---------- Reusable field types ----------

// סוג שדה: מזהה ייחודי.
// נקרא מ: audit-log.routes.js, automation-rules.routes.js, insights.routes.js, meetings.routes.js +3
export const uuid = z.guid();
// סוג שדה: מחרוזת לא ריקה.
// נקרא מ: auth.routes.js, automation-rules.routes.js, comments.routes.js, organizations.routes.js +3
export const nonEmptyString = z.string().min(1);

// A date string like "2026-09-28" or "2026-09-28T10:00:00.000Z", converted to a Date.
// סוג שדה: מחרוזת תאריך שהופכת ל-Date.
// נקרא מ: permissions.routes.js, planning.routes.js, projects.routes.js, tasks.routes.js
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'must be an ISO date string')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be a valid date')
  .transform((value) => new Date(value));

// Query-string values always arrive as strings: "true" / "false" -> boolean.
// סוג שדה: "true" או "false" מהכתובת שהופך לבוליאני.
// נקרא מ: tasks.routes.js
export const queryBoolean = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

// ?page=1&pageSize=20&cursor=<id>
// שדות הדפדוף המשותפים: עמוד, גודל עמוד וסמן.
// נקרא מ: audit-log.routes.js, tasks.routes.js, users.routes.js
export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.guid().optional(),
};

// Prisma enums (same values as schema.prisma).
// הערכים המותרים לתפקיד.
// נקרא מ: permissions.routes.js, users.routes.js
export const RoleName = z.enum(['EMPLOYEE', 'PROJECT_MANAGER', 'ORG_ADMIN', 'SYSTEM_ADMIN']);
// הערכים המותרים לסטטוס משתמש.
// נקרא מ: users.routes.js
export const UserStatus = z.enum(['ACTIVE', 'SUSPENDED', 'INVITED']);
// הערכים המותרים לסטטוס ארגון.
// נקרא מ: organizations.routes.js
export const OrganizationStatus = z.enum(['ACTIVE', 'SUSPENDED']);
// הערכים המותרים לסטטוס פרויקט.
// נקרא מ: projects.routes.js
export const ProjectStatus = z.enum(['PLANNING', 'ACTIVE', 'AT_RISK', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']);
// הערכים המותרים לעדיפות משימה.
// נקרא מ: tasks.routes.js
export const TaskPriority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
// ארבע קטגוריות העמודה.
// נקרא מ: projects.routes.js, tasks.routes.js
export const TaskStatusCategory = z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']);
// סוגי התלות בין משימות.
// נקרא מ: tasks.routes.js
export const DependencyType = z.enum(['BLOCKS', 'RELATES_TO']);
// התפקידים האפשריים בתוך פרויקט.
// נקרא מ: projects.routes.js
export const ProjectMemberRole = z.enum(['MANAGER', 'CONTRIBUTOR', 'VIEWER']);
