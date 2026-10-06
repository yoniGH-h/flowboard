// The permission catalog - every permission the server checks, and which roles get it by
// default. This file is the single source of truth: the seed copies it into the database,
// and the Roles & Permissions screen shows it.
//
// Each permission has a SCOPE, which decides WHERE it applies:
//   'organization'     - organization-wide actions (manage users, view the audit log...)
//   'managed-project'  - only in projects the user MANAGES (their own projects; an Org Admin
//                        manages every project). Having the permission is never enough on its
//                        own - a Project Manager still can't touch someone else's project.
//   'member-project'   - in any project the user BELONGS to.
//   'system'           - platform-wide (System Administrator). Never changeable by an org.
//
// On top of the role defaults, an Org Admin can (see effective.js):
//   1. change a role's permissions for their organization, and
//   2. give a single employee an exception - an extra permission or a removed one,
//      optionally until an expiry date.

export const PERMISSIONS = [
  // --- Work inside projects the user belongs to ---
  // `includedIn`: a stronger permission that already covers this one (whoever has tasks.manage
  // can also create tasks and move their own) - used when checking "may you grant this?".
  { key: 'tasks.move.own', group: 'Tasks', scope: 'member-project', label: 'Move own tasks', description: 'Move tasks assigned to them between board columns.', includedIn: ['tasks.manage'] },
  { key: 'tasks.create', group: 'Tasks', scope: 'member-project', label: 'Create tasks', description: 'Create new tasks in projects they belong to.', includedIn: ['tasks.manage'] },
  { key: 'comments.create', group: 'Collaboration', scope: 'member-project', label: 'Comment on tasks', description: 'Write comments on tasks.' },
  { key: 'attachments.upload', group: 'Collaboration', scope: 'member-project', label: 'Upload files', description: 'Attach files to tasks.' },
  { key: 'calls.start', group: 'Collaboration', scope: 'organization', label: 'Start voice / Zoom calls', description: 'Call teammates with the voice and Zoom buttons.' },

  // --- Managing projects the user manages ---
  { key: 'projects.create', group: 'Projects', scope: 'organization', label: 'Create projects', description: 'Create new projects (managed by themselves).' },
  { key: 'projects.update', group: 'Projects', scope: 'managed-project', label: 'Edit & archive projects', description: 'Edit the details of, and archive, the projects they manage.' },
  { key: 'members.manage', group: 'Projects', scope: 'managed-project', label: 'Manage project team', description: 'Add and remove members of the projects they manage.' },
  { key: 'board.configure', group: 'Projects', scope: 'managed-project', label: 'Configure boards', description: 'Add, rename and remove board columns and WIP limits.' },
  { key: 'tasks.manage', group: 'Tasks', scope: 'managed-project', label: 'Manage all tasks', description: 'Create, edit, assign, move, archive and delete any task in the projects they manage.' },
  { key: 'content.moderate', group: 'Collaboration', scope: 'managed-project', label: 'Moderate comments & files', description: "Delete other people's comments and files in the projects they manage." },
  { key: 'reports.view', group: 'Reports', scope: 'organization', label: 'View reports & dashboards', description: 'Management Dashboard, Team Workload and Reports (for the projects they manage).' },

  // --- Organization administration ---
  { key: 'users.manage', group: 'Administration', scope: 'organization', label: 'Manage users', description: 'Suspend, remove and change the roles of users.', lockedFor: ['ORG_ADMIN'] },
  { key: 'permissions.manage', group: 'Administration', scope: 'organization', label: 'Manage permissions', description: 'Change role permissions and give employees permission exceptions.', lockedFor: ['ORG_ADMIN'] },
  { key: 'organization.settings.manage', group: 'Administration', scope: 'organization', label: 'Organization settings', description: 'Change the organization name, branding and settings.' },
  { key: 'automation.manage', group: 'Administration', scope: 'organization', label: 'Automation rules', description: 'Create and edit automation rules.' },
  { key: 'audit.view', group: 'Administration', scope: 'organization', label: 'View audit log', description: "Read the organization's audit log." },

  // --- Platform (System Administrator only) ---
  { key: 'organizations.manage', group: 'Platform', scope: 'system', label: 'Manage organizations', description: 'View and suspend every organization on the platform.' },
  { key: 'system.audit.view', group: 'Platform', scope: 'system', label: 'System activity', description: 'Read the cross-organization activity feed.' },
];

export const PERMISSION_KEYS = new Set(PERMISSIONS.map((p) => p.key));
export const PERMISSION_BY_KEY = new Map(PERMISSIONS.map((p) => [p.key, p]));

// Default permissions of each role. A user with several roles gets the union.
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

export const ROLE_DEFAULTS = { EMPLOYEE, PROJECT_MANAGER, ORG_ADMIN, SYSTEM_ADMIN };

// Roles an organization may customize. SYSTEM_ADMIN is platform-level and stays fixed.
export const EDITABLE_ROLES = ['EMPLOYEE', 'PROJECT_MANAGER', 'ORG_ADMIN'];

// Can this permission be changed by an organization at all?
export const isChangeable = (key) => PERMISSION_BY_KEY.get(key)?.scope !== 'system';

// May someone holding `permissions` hand out `key`? Only if they have it themselves, or a
// stronger permission that includes it - nobody can grant more than they can do.
export const canGrant = (permissions, key) =>
  permissions.has(key) || (PERMISSION_BY_KEY.get(key)?.includedIn ?? []).some((k) => permissions.has(k));

// Is removing this permission from this role forbidden? (Keeps an organization from locking
// every admin out of user / permission management.)
export const isLockedFor = (key, roleName) => PERMISSION_BY_KEY.get(key)?.lockedFor?.includes(roleName) ?? false;
