// קטלוג ההרשאות וברירות המחדל לכל תפקיד.

// קטלוג ההרשאות - כל הרשאה שהשרת בודק, ואילו תפקידים מקבלים אותה כברירת
// מחדל. הקובץ הזה הוא מקור האמת היחיד: נתוני הדמו מעתיקים אותו למסד,
// ומסך התפקידים וההרשאות מציג אותו.
//
// לכל הרשאה יש היקף (scope), שקובע איפה היא חלה:
//   'organization'     - פעולות ברמת הארגון (ניהול משתמשים, צפייה ביומן הביקורת...)
//   'managed-project'  - רק בפרויקטים שהמשתמש מנהל (הפרויקטים שלו; מנהל ארגון
//                        מנהל את כל הפרויקטים). ההרשאה לבדה אף פעם לא מספיקה -
//                        מנהל פרויקט עדיין לא יכול לגעת בפרויקט של מישהו אחר.
//   'member-project'   - בכל פרויקט שהמשתמש חבר בו.
//   'system'           - ברמת הפלטפורמה (מנהל מערכת). ארגון לא יכול לשנות אותה.
//
// מעבר לברירות המחדל של התפקיד, מנהל ארגון יכול (ראו effective.js):
//   1. לשנות את ההרשאות של תפקיד בארגון שלו, וגם
//   2. לתת לעובד יחיד חריג - הרשאה נוספת או שלילת הרשאה,
//      עם תאריך תפוגה אם רוצים.

// רשימת כל ההרשאות: מפתח, קבוצה, היקף ותיאור.
// נקרא מ: permissions.service.js, effective.js
export const PERMISSIONS = [
  // --- עבודה בתוך פרויקטים שהמשתמש חבר בהם ---
  // includedIn: הרשאה חזקה יותר שכבר כוללת את זו (מי שיש לו tasks.manage
  // יכול גם ליצור משימות ולהזיז את שלו) - משמש בבדיקה "האם מותר לך להעניק את זה?".
  { key: 'tasks.move.own', group: 'Tasks', scope: 'member-project', label: 'Move own tasks', description: 'Move tasks assigned to them between board columns.', includedIn: ['tasks.manage'] },
  { key: 'tasks.create', group: 'Tasks', scope: 'member-project', label: 'Create tasks', description: 'Create new tasks in projects they belong to.', includedIn: ['tasks.manage'] },
  { key: 'comments.create', group: 'Collaboration', scope: 'member-project', label: 'Comment on tasks', description: 'Write comments on tasks.' },
  { key: 'attachments.upload', group: 'Collaboration', scope: 'member-project', label: 'Upload files', description: 'Attach files to tasks.' },
  { key: 'calls.start', group: 'Collaboration', scope: 'organization', label: 'Start voice / Zoom calls', description: 'Call teammates with the voice and Zoom buttons.' },

  // --- ניהול פרויקטים שהמשתמש מנהל ---
  { key: 'projects.create', group: 'Projects', scope: 'organization', label: 'Create projects', description: 'Create new projects (managed by themselves).' },
  { key: 'projects.update', group: 'Projects', scope: 'managed-project', label: 'Edit & archive projects', description: 'Edit the details of, and archive, the projects they manage.' },
  { key: 'members.manage', group: 'Projects', scope: 'managed-project', label: 'Manage project team', description: 'Add and remove members of the projects they manage.' },
  { key: 'board.configure', group: 'Projects', scope: 'managed-project', label: 'Configure boards', description: 'Add, rename and remove board columns and WIP limits.' },
  { key: 'tasks.manage', group: 'Tasks', scope: 'managed-project', label: 'Manage all tasks', description: 'Create, edit, assign, move, archive and delete any task in the projects they manage.' },
  { key: 'content.moderate', group: 'Collaboration', scope: 'managed-project', label: 'Moderate comments & files', description: "Delete other people's comments and files in the projects they manage." },
  { key: 'reports.view', group: 'Reports', scope: 'organization', label: 'View reports & dashboards', description: 'Management Dashboard, Team Workload and Reports (for the projects they manage).' },

  // --- ניהול הארגון ---
  { key: 'users.manage', group: 'Administration', scope: 'organization', label: 'Manage users', description: 'Suspend, remove and change the roles of users.', lockedFor: ['ORG_ADMIN'] },
  { key: 'permissions.manage', group: 'Administration', scope: 'organization', label: 'Manage permissions', description: 'Change role permissions and give employees permission exceptions.', lockedFor: ['ORG_ADMIN'] },
  { key: 'organization.settings.manage', group: 'Administration', scope: 'organization', label: 'Organization settings', description: 'Change the organization name, branding and settings.' },
  { key: 'automation.manage', group: 'Administration', scope: 'organization', label: 'Automation rules', description: 'Create and edit automation rules.' },
  { key: 'audit.view', group: 'Administration', scope: 'organization', label: 'View audit log', description: "Read the organization's audit log." },

  // --- הפלטפורמה (מנהל מערכת בלבד) ---
  { key: 'organizations.manage', group: 'Platform', scope: 'system', label: 'Manage organizations', description: 'View and suspend every organization on the platform.' },
  { key: 'system.audit.view', group: 'Platform', scope: 'system', label: 'System activity', description: 'Read the cross-organization activity feed.' },
];

// קבוצת כל מפתחות ההרשאה, לבדיקה מהירה.
// נקרא מ: auth.js
export const PERMISSION_KEYS = new Set(PERMISSIONS.map((p) => p.key));
// מפה ממפתח הרשאה אל ההגדרה שלה.
// נקרא מ: permissions.service.js, projects.service.js
export const PERMISSION_BY_KEY = new Map(PERMISSIONS.map((p) => [p.key, p]));

// הרשאות ברירת המחדל של כל תפקיד. משתמש עם כמה תפקידים מקבל את האיחוד שלהן.
const EMPLOYEE = ['tasks.move.own', 'comments.create', 'attachments.upload', 'calls.start'];
const PROJECT_MANAGER = [
  ...EMPLOYEE,
  'projects.create',
  'projects.update',
  'members.manage',
  'board.configure',
  'tasks.manage',
  'content.moderate',
  'reports.view',
];
const ORG_ADMIN = [
  ...PROJECT_MANAGER,
  'users.manage',
  'permissions.manage',
  'organization.settings.manage',
  'automation.manage',
  'audit.view',
];
const SYSTEM_ADMIN = [...ORG_ADMIN, 'organizations.manage', 'system.audit.view'];

// הרשאות ברירת המחדל של כל תפקיד.
// נקרא מ: permissions.service.js, effective.js
export const ROLE_DEFAULTS = { EMPLOYEE, PROJECT_MANAGER, ORG_ADMIN, SYSTEM_ADMIN };

// התפקידים שארגון רשאי להתאים. SYSTEM_ADMIN הוא ברמת הפלטפורמה ונשאר קבוע.
// התפקידים שארגון רשאי לשנות את ההרשאות שלהם.
// נקרא מ: permissions.service.js, effective.js
export const EDITABLE_ROLES = ['EMPLOYEE', 'PROJECT_MANAGER', 'ORG_ADMIN'];

// האם ארגון יכול בכלל לשנות את ההרשאה הזו?
// האם ארגון רשאי לשנות את ההרשאה הזו.
// נקרא מ: permissions.service.js
// קורא ל: —
export const isChangeable = (key) => PERMISSION_BY_KEY.get(key)?.scope !== 'system';

// האם מי שמחזיק ב-permissions רשאי להעניק את key? רק אם יש לו אותה בעצמו, או
// הרשאה חזקה יותר שכוללת אותה - אף אחד לא יכול להעניק יותר ממה שמותר לו.
// האם למשתמש מותר להעניק את ההרשאה הזו לאחרים.
// נקרא מ: permissions.service.js
// קורא ל: —
export const canGrant = (permissions, key) =>
  permissions.has(key) || (PERMISSION_BY_KEY.get(key)?.includedIn ?? []).some((k) => permissions.has(k));

// האם אסור לשלול את ההרשאה הזו מהתפקיד הזה? (מונע מארגון לנעול את
// כל המנהלים מחוץ לניהול המשתמשים וההרשאות.)
// האם ההרשאה נעולה לתפקיד הזה ואי אפשר לשלול אותה.
// נקרא מ: permissions.service.js
// קורא ל: —
export const isLockedFor = (key, roleName) => PERMISSION_BY_KEY.get(key)?.lockedFor?.includes(roleName) ?? false;
