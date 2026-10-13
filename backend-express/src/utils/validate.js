// בדיקת קלט עם zod.

// בדיקת קלט עם zod. כל נתיב בודק את הקלט שלו במפורש:
//
//   const dto = parse(createTaskSchema, req.body);
//
// הסכמות הן "strict", כך ששדות לא מוכרים נדחים (400) ולא נבלעים בשקט.
import { z } from 'zod';
import { badRequest } from './httpError.js';

// בודק קלט מול סכמה; זורק 400 עם פירוט אם לא תקין.
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

// ---------- סוגי שדות לשימוש חוזר ----------

// סוג שדה: מזהה ייחודי.
export const uuid = z.guid();
// סוג שדה: מחרוזת לא ריקה.
export const nonEmptyString = z.string().min(1);

// סוג שדה: מחרוזת תאריך שהופכת ל-Date.
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'must be an ISO date string')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be a valid date')
  .transform((value) => new Date(value));

// סוג שדה: "true" או "false" מהכתובת שהופך לבוליאני.
export const queryBoolean = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

// שדות הדפדוף המשותפים: עמוד, גודל עמוד וסמן.
export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.guid().optional(),
};

// הערכים המותרים לתפקיד.
export const RoleName = z.enum(['EMPLOYEE', 'PROJECT_MANAGER', 'ORG_ADMIN', 'SYSTEM_ADMIN']);
// הערכים המותרים לסטטוס משתמש.
export const UserStatus = z.enum(['ACTIVE', 'SUSPENDED', 'INVITED']);
// הערכים המותרים לסטטוס ארגון.
export const OrganizationStatus = z.enum(['ACTIVE', 'SUSPENDED']);
// הערכים המותרים לסטטוס פרויקט.
export const ProjectStatus = z.enum(['PLANNING', 'ACTIVE', 'AT_RISK', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']);
// הערכים המותרים לעדיפות משימה.
export const TaskPriority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
// ארבע קטגוריות העמודה.
export const TaskStatusCategory = z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']);
// סוגי התלות בין משימות.
export const DependencyType = z.enum(['BLOCKS', 'RELATES_TO']);
// התפקידים האפשריים בתוך פרויקט.
export const ProjectMemberRole = z.enum(['MANAGER', 'CONTRIBUTOR', 'VIEWER']);
