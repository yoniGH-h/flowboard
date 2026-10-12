// לוגיקת הפרויקטים.
// חלקים עיקריים: מי מנהל איזה פרויקט, סיכון והיסטוריה שלו, בדיקות גישה והרשאה, יצירה ועדכון, חברי צוות, קבצים ופעילות, לוח ועמודות.

import { prisma } from '../../db.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { PERMISSION_BY_KEY } from '../../permissions/catalog.js';
import { isManager, isOrgAdmin } from '../../utils/permissions.js';
import { recordAudit } from '../audit-log/audit-log.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import { calculateRisk } from './risk.js';

// כל פרויקט חדש מקבל לוח Kanban עם העמודות האלה.
const DEFAULT_COLUMNS = [
  { name: 'Backlog', category: 'TODO', order: 0 },
  { name: 'To Do', category: 'TODO', order: 1 },
  { name: 'In Progress', category: 'IN_PROGRESS', order: 2, wipLimit: 5 },
  { name: 'In Review', category: 'REVIEW', order: 3, wipLimit: 4 },
  { name: 'Done', category: 'DONE', order: 4 },
];

const USER_BRIEF = { select: { id: true, firstName: true, lastName: true, avatarColor: true } };
const USER_WITH_TITLE = { select: { id: true, firstName: true, lastName: true, avatarColor: true, title: true } };

const DETAIL_INCLUDE = {
  manager: USER_WITH_TITLE,
  members: { include: { user: USER_WITH_TITLE } },
  board: { select: { id: true } },
  _count: { select: { tasks: true } },
};

// ---------- מי רשאי לנהל איזה פרויקט ----------
//
//   מנהל ארגון / מנהל מערכת  -> כל הפרויקטים בארגון שלהם
//   מנהל פרויקט               -> רק הפרויקטים שהוא מנהל: הוא המנהל של
//                                הפרויקט, או חבר צוות עם roleOnProject = MANAGER
//   כל השאר                   -> אף פרויקט (חברי צוות עדיין רואים ועובדים על המשימות שלהם)

// project חייב לכלול את members (שורות עם userId ו-roleOnProject).
// האם המשתמש מנהל את הפרויקט הזה.
// נקרא מ: הקובץ הזה בלבד
export function managesProject(actor, project) {
  if (isOrgAdmin(actor)) return true;
  if (!isManager(actor)) return false;
  return (
    project.managerId === actor.userId ||
    project.members.some((m) => m.userId === actor.userId && m.roleOnProject === 'MANAGER')
  );
}

// אותו כלל כתנאי where של Prisma על Project - "הפרויקטים שהמשתמש מנהל".
// תנאי שאילתה: הפרויקטים שהמשתמש מנהל.
// נקרא מ: insights.service.js, planning.service.js, tasks.service.js
export function managedProjectsWhere(actor) {
  if (isOrgAdmin(actor)) return { organizationId: actor.organizationId };
  return {
    organizationId: actor.organizationId,
    OR: [{ managerId: actor.userId }, { members: { some: { userId: actor.userId, roleOnProject: 'MANAGER' } } }],
  };
}

// הפרויקטים שהמשתמש רואה: כל פרויקטי הארגון למנהלי ארגון, ואחרת אלה שהוא
// חבר בהם (מנהל הפרויקט הוא תמיד אחד מחברי הצוות שלו).
// תנאי שאילתה: הפרויקטים שהמשתמש רשאי לראות.
// נקרא מ: tasks.service.js
export function visibleProjectsWhere(actor) {
  if (isOrgAdmin(actor)) return { organizationId: actor.organizationId };
  return {
    organizationId: actor.organizationId,
    OR: [{ managerId: actor.userId }, { members: { some: { userId: actor.userId } } }],
  };
}

const isMember = (actor, project) => project.members.some((m) => m.userId === actor.userId);

// האם למשתמש מותר להשתמש בהרשאה הזו בפרויקט הזה? שני תנאים:
//   1. יש לו את ההרשאה (ברירות המחדל של התפקיד + שינויי הארגון + חריגים אישיים), וגם
//   2. ההיקף שלה מתאים לפרויקט: הרשאות 'managed-project' פועלות רק בפרויקטים שהוא
//      מנהל, והרשאות 'member-project' בכל פרויקט שהוא חבר בו.
// האם למשתמש יש הרשאה מסוימת בפרויקט הזה.
// נקרא מ: הקובץ הזה בלבד
export function projectCan(actor, project, key) {
  if (!actor.permissions.has(key)) return false;
  const scope = PERMISSION_BY_KEY.get(key)?.scope;
  if (scope === 'managed-project') return managesProject(actor, project);
  if (scope === 'member-project') return managesProject(actor, project) || isMember(actor, project);
  return true;
}

// כל מה שהאתר צריך כדי להציג או להסתיר כפתורים בפרויקט אחד.
// (השרת בודק את אותם כללים שוב בכל בקשה.)
function projectAbilities(actor, project) {
  const can = (key) => projectCan(actor, project, key);
  return {
    update: can('projects.update'),
    manageMembers: can('members.manage'),
    configureBoard: can('board.configure'),
    manageTasks: can('tasks.manage'),
    createTasks: can('tasks.manage') || can('tasks.create'),
    moveOwnTasks: can('tasks.move.own') || can('tasks.manage'),
    comment: can('comments.create'),
    upload: can('attachments.upload'),
    moderate: can('content.moderate'),
  };
}

// משטח את התוצאה של Prisma למבנה שהאתר מצפה לו, ומוסיף את can (מה מותר
// למשתמש המחובר כאן) ואת canManage (נשמר לקוד ישן באתר = can.manageTasks).
function toDetail(project, actor) {
  const { _count, board, members, ...rest } = project;
  const can = projectAbilities(actor, project);
  return {
    ...rest,
    boardId: board?.id ?? null,
    taskCount: _count.tasks,
    can,
    canManage: can.manageTasks,
    members: members.map((m) => ({ ...m.user, roleOnProject: m.roleOnProject, joinedAt: m.joinedAt })),
  };
}

// דורס את שדות הסיכון השמורים של כל פרויקט בציון שחושב עכשיו. שאילתה אחת
// שולפת את המשימות הפתוחות של כל הפרויקטים יחד (ולא שאילתה לכל פרויקט).
async function attachLiveRisk(details) {
  if (details.length === 0) return details;

  const openTasks = await prisma.task.findMany({
    where: { projectId: { in: details.map((d) => d.id) }, archived: false, completedAt: null },
    select: { projectId: true, assigneeId: true, dueDate: true, blocked: true },
  });

  const tasksByProject = new Map();
  for (const t of openTasks) {
    if (!tasksByProject.has(t.projectId)) tasksByProject.set(t.projectId, []);
    tasksByProject.get(t.projectId).push(t);
  }

  const now = new Date();
  return details.map((d) => ({
    ...d,
    ...calculateRisk(d, tasksByProject.get(d.id) ?? [], d.members.length, now),
  }));
}

// ---------- היסטוריית הסיכון ----------

const DAY_MS = 86_400_000;
const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// שומר את ציון הסיכון של היום לכל פרויקט פעיל (שורה אחת לפרויקט ליום - הרצה
// נוספת באותו יום רק מעדכנת את השורה). נקרא כשהשרת עולה וכל שעה
// (server.js), כדי שהתובנות יוכלו להציג איך הסיכון משתנה לאורך זמן.
// שומר את ציון הסיכון של היום לכל פרויקט.
// נקרא מ: server.js
export async function recordRiskSnapshots(now = new Date()) {
  const projects = await prisma.project.findMany({ where: { archived: false }, include: { members: true } });
  const withRisk = await attachLiveRisk(projects);
  const day = startOfUtcDay(now);
  for (const p of withRisk) {
    await prisma.projectRiskSnapshot.upsert({
      where: { projectId_day: { projectId: p.id, day } },
      update: { riskScore: p.riskScore, riskLevel: p.riskLevel },
      create: { projectId: p.id, day, riskScore: p.riskScore, riskLevel: p.riskLevel },
    });
  }
  return withRisk.length;
}

// GET /api/projects/:id/risk-history - ציוני הסיכון היומיים של הפרויקט ב-days הימים האחרונים.
// מחזיר את ציוני הסיכון היומיים של פרויקט.
// נקרא מ: projects.routes.js
export async function getRiskHistory(actor, projectId, days = 30) {
  await assertAccessible(actor, projectId);
  const since = startOfUtcDay(new Date(Date.now() - days * DAY_MS));
  return prisma.projectRiskSnapshot.findMany({
    where: { projectId, day: { gte: since } },
    orderBy: { day: 'asc' },
    select: { day: true, riskScore: true, riskLevel: true },
  });
}

async function loadDetail(actor, id) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id }, include: DETAIL_INCLUDE });
  const [detail] = await attachLiveRisk([toDetail(project, actor)]);
  return detail;
}

// משמש גם את המודולים של משימות, תגובות, קבצים ופגישות. הפרויקט חייב להיות
// בארגון של המשתמש, והמשתמש חייב להיות חבר בו או לנהל אותו.
// מחזיר את הפרויקט (עם חברי הצוות) ואת can(key) - projectCan שקשור לפרויקט הזה.
// מוודא גישה לפרויקט: 404 אם לא בארגון, 403 אם לא חבר.
// נקרא מ: attachments.routes.js, comments.routes.js, meetings.routes.js, tasks.service.js
export async function assertAccessible(actor, projectId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: actor.organizationId },
    include: { members: true },
  });
  if (!project) throw notFound('Project not found');

  if (!managesProject(actor, project) && !isMember(actor, project)) {
    throw forbidden('You are not a member of this project');
  }
  return { ...project, can: (key) => projectCan(actor, project, key) };
}

// assertAccessible ועוד "ומותר לו להשתמש בהרשאה הזו כאן" - הבדיקה שמאחורי כל פעולה בפרויקט.
//   await assertProjectPermission(actor, projectId, 'tasks.manage')
// מוודא גישה וגם הרשאה מסוימת בפרויקט.
// נקרא מ: attachments.routes.js, comments.routes.js, insights.service.js, planning.service.js +2
export async function assertProjectPermission(actor, projectId, key) {
  const project = await assertAccessible(actor, projectId);
  if (!project.can(key)) {
    const scope = PERMISSION_BY_KEY.get(key)?.scope;
    throw forbidden(
      scope === 'managed-project' && actor.permissions.has(key)
        ? "Only this project's manager (or an organization admin) can do this"
        : 'You do not have permission to perform this action',
    );
  }
  return project;
}

// מנהל של פרויקט חייב להחזיק בתפקיד מנהל פרויקט (או גבוה ממנו) בארגון.
async function requireEligibleManager(actor, userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId },
    include: { roles: { include: { role: true } } },
  });
  if (!user) throw notFound('Selected manager was not found in your organization');
  if (!isManager({ roles: user.roles.map((r) => r.role.name) })) {
    throw badRequest(`${user.firstName} ${user.lastName} is not a Project Manager`);
  }
}

// יוצר פרויקט, עם לוח ועמודות ברירת מחדל.
// נקרא מ: projects.routes.js
export async function create(actor, dto) {
  // מנהל פרויקט יוצר פרויקטים לעצמו; רק מנהל ארגון בוחר מנהל אחר.
  if (!isOrgAdmin(actor) && dto.managerId !== actor.userId) {
    throw forbidden('Project Managers can only create projects that they manage themselves');
  }
  await requireEligibleManager(actor, dto.managerId);

  // המנהל והיוצר הם תמיד חברי צוות.
  const memberIds = new Set([dto.managerId, actor.userId, ...(dto.memberIds ?? [])]);

  const members = await prisma.user.findMany({
    where: { id: { in: [...memberIds] }, organizationId: actor.organizationId },
  });
  if (members.length !== memberIds.size) {
    throw notFound('One or more selected members were not found in your organization');
  }

  // הפרויקט, חברי הצוות, הלוח והעמודות נוצרים יחד בכתיבה מקוננת אחת.
  const project = await prisma.project.create({
    data: {
      organizationId: actor.organizationId,
      name: dto.name,
      description: dto.description,
      managerId: dto.managerId,
      startDate: dto.startDate,
      targetDate: dto.targetDate,
      status: 'PLANNING',
      progress: 0,
      riskScore: 0,
      riskLevel: 'LOW',
      riskFactors: [],
      members: {
        create: [...memberIds].map((userId) => ({
          userId,
          roleOnProject: userId === dto.managerId ? 'MANAGER' : 'CONTRIBUTOR',
        })),
      },
      board: {
        create: { name: `${dto.name} Board`, columns: { create: DEFAULT_COLUMNS } },
      },
    },
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'PROJECT_CREATED',
    entityType: 'Project',
    entityId: project.id,
    projectId: project.id,
    metadata: { name: project.name },
  });

  return loadDetail(actor, project.id);
}

// שולף את הפרויקטים שהמשתמש רשאי לראות.
// נקרא מ: projects.routes.js
export async function findAll(actor, query) {
  const wantsAll = query.scope === 'all';
  if (wantsAll && !isManager(actor)) {
    throw forbidden('You do not have permission to view all organization projects');
  }

  const projects = await prisma.project.findMany({
    where: {
      // "all" = כל הפרויקטים שהמשתמש מנהל (למנהל ארגון: כל הארגון);
      // "mine" = הפרויקטים שהמשתמש חבר בהם.
      ...(wantsAll
        ? managedProjectsWhere(actor)
        : { organizationId: actor.organizationId, members: { some: { userId: actor.userId } } }),
      archived: query.includeArchived === 'true' ? undefined : false,
      status: query.status,
      name: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
    },
    include: DETAIL_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  return attachLiveRisk(projects.map((p) => toDetail(p, actor)));
}

// שולף פרויקט אחד עם הפרטים והיכולות של המשתמש בו.
// נקרא מ: projects.routes.js
export async function findOne(actor, id) {
  await assertAccessible(actor, id);
  return loadDetail(actor, id);
}

// מעדכן את פרטי הפרויקט.
// נקרא מ: planning.service.js, projects.routes.js
export async function update(actor, id, dto) {
  const project = await assertProjectPermission(actor, id, 'projects.update');
  const managerChanges = dto.managerId && dto.managerId !== project.managerId;

  if (managerChanges) {
    // העברת פרויקט למישהו אחר היא החלטה של מנהל ארגון - אחרת מנהל
    // פרויקט היה יכול למסור (או לקחת) שליטה על פרויקט.
    if (!isOrgAdmin(actor)) {
      throw forbidden('Only an organization admin can assign a project to a different manager');
    }
    await requireEligibleManager(actor, dto.managerId);
  }

  await prisma.$transaction([
    prisma.project.update({ where: { id }, data: dto }),
    // שומרים על רשימת החברים מסונכרנת: המנהל החדש הוא חבר בתפקיד MANAGER, והישן הופך לתורם.
    ...(managerChanges
      ? [
          prisma.projectMember.updateMany({
            where: { projectId: id, userId: project.managerId, roleOnProject: 'MANAGER' },
            data: { roleOnProject: 'CONTRIBUTOR' },
          }),
          prisma.projectMember.upsert({
            where: { projectId_userId: { projectId: id, userId: dto.managerId } },
            update: { roleOnProject: 'MANAGER' },
            create: { projectId: id, userId: dto.managerId, roleOnProject: 'MANAGER' },
          }),
        ]
      : []),
  ]);

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'PROJECT_UPDATED',
    entityType: 'Project',
    entityId: id,
    projectId: id,
    metadata: { fields: Object.keys(dto) },
  });

  return loadDetail(actor, id);
}

// מעביר פרויקט לארכיון או מחזיר ממנו.
// נקרא מ: projects.routes.js
export async function setArchived(actor, id, archived) {
  await assertProjectPermission(actor, id, 'projects.update');
  await prisma.project.update({ where: { id }, data: { archived } });

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: archived ? 'PROJECT_ARCHIVED' : 'PROJECT_UNARCHIVED',
    entityType: 'Project',
    entityId: id,
    projectId: id,
  });

  return loadDetail(actor, id);
}

// ---------- חברי צוות ----------

// roleOnProject = MANAGER הופך מישהו למנהל-שותף עם שליטה מלאה בפרויקט, ולכן
// רק מנהל ארגון רשאי לתת אותו (כמו בהחלפת מנהל הפרויקט).
function assertCanGrantRole(actor, roleOnProject) {
  if (roleOnProject === 'MANAGER' && !isOrgAdmin(actor)) {
    throw forbidden('Only an organization admin can make someone a manager of this project');
  }
}

// מוסיף חבר צוות לפרויקט.
// נקרא מ: planning.service.js, projects.routes.js
export async function addMember(actor, projectId, dto) {
  await assertProjectPermission(actor, projectId, 'members.manage');
  assertCanGrantRole(actor, dto.roleOnProject);

  const user = await prisma.user.findFirst({
    where: { id: dto.userId, organizationId: actor.organizationId },
  });
  if (!user) throw notFound('User not found in your organization');

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: dto.userId } },
  });
  if (existing) throw conflict('This user is already a member of the project');

  await prisma.projectMember.create({
    data: { projectId, userId: dto.userId, roleOnProject: dto.roleOnProject ?? 'CONTRIBUTOR' },
  });

  await createNotification({
    organizationId: actor.organizationId,
    userId: dto.userId,
    type: 'MEMBER_ADDED',
    title: 'Added to a project',
    body: 'You were added to a project.',
    relatedProjectId: projectId,
  });

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'PROJECT_MEMBER_ADDED',
    entityType: 'Project',
    entityId: projectId,
    projectId,
    metadata: { userId: dto.userId },
  });

  return findOne(actor, projectId);
}

// משנה את התפקיד של חבר צוות בפרויקט.
// נקרא מ: projects.routes.js
export async function updateMember(actor, projectId, userId, dto) {
  const project = await assertProjectPermission(actor, projectId, 'members.manage');
  const member = await requireMember(projectId, userId);
  // קידום ל-MANAGER, או הורדה של מנהל-שותף קיים, משנים שניהם מי שולט בפרויקט.
  assertCanGrantRole(actor, dto.roleOnProject);
  assertCanGrantRole(actor, member.roleOnProject);
  if (userId === project.managerId && dto.roleOnProject !== 'MANAGER') {
    throw conflict("The project's manager must keep the MANAGER role. Reassign the manager first.");
  }
  await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { roleOnProject: dto.roleOnProject },
  });
  return findOne(actor, projectId);
}

// מסיר חבר צוות מהפרויקט.
// נקרא מ: projects.routes.js
export async function removeMember(actor, projectId, userId) {
  const project = await assertProjectPermission(actor, projectId, 'members.manage');
  if (project.managerId === userId) {
    throw conflict('The project manager cannot be removed from the project. Reassign the manager first.');
  }
  const member = await requireMember(projectId, userId);
  assertCanGrantRole(actor, member.roleOnProject); // הסרת מנהל-שותף היא החלטה של מנהל ארגון

  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });

  await recordAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: 'PROJECT_MEMBER_REMOVED',
    entityType: 'Project',
    entityId: projectId,
    projectId,
    metadata: { userId },
  });

  return findOne(actor, projectId);
}

async function requireMember(projectId, userId) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) throw notFound('This user is not a member of the project');
  return member;
}

// ---------- קבצים ופעילות ברמת הפרויקט ----------

// שולף את כל הקבצים של הפרויקט.
// נקרא מ: projects.routes.js
export async function getAttachments(actor, projectId) {
  await assertAccessible(actor, projectId);
  return prisma.attachment.findMany({
    where: { task: { projectId } },
    orderBy: { uploadedAt: 'desc' },
    include: { uploadedBy: USER_BRIEF },
  });
}

// שולף את הפעילות האחרונה בפרויקט.
// נקרא מ: projects.routes.js
export async function getActivity(actor, projectId) {
  await assertAccessible(actor, projectId);
  return prisma.activityEntry.findMany({
    where: { task: { projectId } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { actor: USER_BRIEF },
  });
}

// ---------- לוח ה-Kanban ----------

// שולף את הלוח: עמודות לפי הסדר והמשימות שבכל אחת.
// נקרא מ: projects.routes.js
export async function getBoard(actor, projectId) {
  await assertAccessible(actor, projectId);
  const board = await prisma.board.findUnique({
    where: { projectId },
    include: {
      columns: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            where: { archived: false },
            orderBy: { createdAt: 'asc' },
            include: {
              assignee: USER_BRIEF,
              labels: { include: { label: true } },
              _count: { select: { comments: true, attachments: true } },
            },
          },
        },
      },
    },
  });
  if (!board) throw notFound('Board not found');
  return board;
}

// מוסיף עמודה ללוח.
// נקרא מ: projects.routes.js
export async function addColumn(actor, projectId, dto) {
  await assertProjectPermission(actor, projectId, 'board.configure');
  const board = await prisma.board.findUnique({ where: { projectId }, include: { columns: true } });
  if (!board) throw notFound('Board not found');

  await prisma.boardColumn.create({
    data: { boardId: board.id, order: board.columns.length, ...dto },
  });
  return getBoard(actor, projectId);
}

// מעדכן עמודה: שם, סדר או מגבלת WIP.
// נקרא מ: projects.routes.js
export async function updateColumn(actor, projectId, columnId, dto) {
  await assertProjectPermission(actor, projectId, 'board.configure');
  await requireColumnInProject(projectId, columnId);
  await prisma.boardColumn.update({ where: { id: columnId }, data: dto });
  return getBoard(actor, projectId);
}

// מוחק עמודה ריקה מהלוח.
// נקרא מ: projects.routes.js
export async function removeColumn(actor, projectId, columnId) {
  await assertProjectPermission(actor, projectId, 'board.configure');
  await requireColumnInProject(projectId, columnId);

  const taskCount = await prisma.task.count({ where: { columnId, archived: false } });
  if (taskCount > 0) {
    throw conflict('Move or archive the tasks in this column before deleting it');
  }

  await prisma.boardColumn.delete({ where: { id: columnId } });
  return getBoard(actor, projectId);
}

async function requireColumnInProject(projectId, columnId) {
  const column = await prisma.boardColumn.findFirst({
    where: { id: columnId, board: { projectId } },
  });
  if (!column) throw notFound('Column not found on this project board');
  return column;
}
