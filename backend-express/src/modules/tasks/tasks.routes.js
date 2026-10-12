// נתיבי המשימות.

import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import {
  DependencyType,
  isoDate,
  nonEmptyString,
  paginationShape,
  parse,
  queryBoolean,
  TaskPriority,
  TaskStatusCategory,
  uuid,
} from '../../utils/validate.js';
import * as reports from './tasks.reports.js';
import * as tasksService from './tasks.service.js';

// ---------- בדיקת קלט ----------

const labelIds = z
  .array(uuid)
  .refine((ids) => new Set(ids).size === ids.length, 'labelIds must not contain duplicates');

const createTaskSchema = z.strictObject({
  parentTaskId: uuid.optional(),
  projectId: uuid,
  columnId: uuid,
  title: nonEmptyString,
  description: z.string().optional(),
  assigneeId: uuid.optional(),
  priority: TaskPriority.optional(),
  startDate: isoDate.optional(),
  dueDate: isoDate.optional(),
  estimatedHours: z.number().optional(),
  labelIds: labelIds.optional(),
});

const updateTaskSchema = z.strictObject({
  title: nonEmptyString.optional(),
  description: z.string().optional(),
  priority: TaskPriority.optional(),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  estimatedHours: z.number().optional(),
  actualHours: z.number().optional(),
  blocked: z.boolean().optional(),
  labelIds: labelIds.optional(),
});

const queryTasksSchema = z.strictObject({
  ...paginationShape,
  projectId: uuid.optional(),
  assigneeId: z.string().optional(), // מזהה משתמש, או "me"
  status: TaskStatusCategory.optional(),
  priority: TaskPriority.optional(),
  overdue: queryBoolean.optional(),
  blocked: queryBoolean.optional(),
  search: z.string().optional(),
  sortBy: z.enum(['dueDate', 'priority', 'createdAt', 'updatedAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const projectFilterSchema = z.strictObject({ projectId: uuid.optional() });

const queryReportsSchema = z.strictObject({
  projectId: uuid.optional(),
  assigneeId: z.string().optional(),
  days: z.coerce.number().int().min(0).optional(),
});

const moveSchema = z.strictObject({ columnId: uuid });
const assignSchema = z.strictObject({ assigneeId: uuid.nullable().optional() });
const archiveSchema = z.strictObject({ archived: z.boolean() });
const addDependencySchema = z.strictObject({
  dependsOnTaskId: uuid,
  type: DependencyType.optional(),
});

// ---------- נתיבים ----------

// פעולות על משימות נבדקות לכל פרויקט בתוך tasks.service.js (tasks.manage / tasks.create /
// tasks.move.own), כי אותו משתמש יכול לנהל פרויקט אחד ורק לעבוד באחר.
// הראוטר של המשימות.
// נקרא מ: app.js
export const tasksRouter = Router();
const canViewReports = requirePermission('reports.view');

// יוצר משימה אחרי בדיקת הרשאה, עמודה ואחראי.
// נקרא מ: createTask (api.js)
// קורא ל: tasksService.create, parse
tasksRouter.post('/', async (req, res) => {
  res.status(201).json(await tasksService.create(req.user, parse(createTaskSchema, req.body)));
});

// שולף משימות לפי סינון.
// נקרא מ: fetchTasks (api.js)
// קורא ל: tasksService.findAll, parse
tasksRouter.get('/', async (req, res) => {
  res.json(await tasksService.findAll(req.user, parse(queryTasksSchema, req.query)));
});

// נתיבי הסיכום מוגדרים לפני '/:id', אחרת Express היה מתייחס אל
// "workload-summary" כאל מזהה של משימה.
// מחשב לכל עובד משימות פתוחות, איחורים ושעות.
// נקרא מ: fetchWorkloadSummary (api.js)
// קורא ל: parse, reports.getWorkloadSummary
tasksRouter.get('/workload-summary', canViewReports, async (req, res) => {
  const { projectId } = parse(projectFilterSchema, req.query);
  res.json(await reports.getWorkloadSummary(req.user, projectId));
});

// מחשב את נתוני הדשבורד הניהולי, כולל גרף ההתקדמות.
// נקרא מ: fetchDashboardSummary (api.js)
// קורא ל: parse, reports.getDashboardSummary
tasksRouter.get('/dashboard-summary', canViewReports, async (req, res) => {
  const { projectId } = parse(projectFilterSchema, req.query);
  res.json(await reports.getDashboardSummary(req.user, projectId));
});

// מחשב את נתוני מסך הדוחות לפי הסינון.
// נקרא מ: fetchReportsSummary (api.js)
// קורא ל: reports.getReportsSummary, parse
tasksRouter.get('/reports-summary', canViewReports, async (req, res) => {
  res.json(await reports.getReportsSummary(req.user, parse(queryReportsSchema, req.query)));
});

// שולף משימה אחת עם כל הפרטים.
// נקרא מ: fetchTask (api.js)
// קורא ל: tasksService.findOne
tasksRouter.get('/:id', async (req, res) => {
  res.json(await tasksService.findOne(req.user, req.params.id));
});

// שולף את היסטוריית הפעילות של משימה.
// נקרא מ: fetchTaskActivity (api.js)
// קורא ל: tasksService.getActivity
tasksRouter.get('/:id/activity', async (req, res) => {
  res.json(await tasksService.getActivity(req.user, req.params.id));
});

// מוסיף תלות בין שתי משימות.
// נקרא מ: addTaskDependency (api.js)
// קורא ל: parse, tasksService.addDependency
tasksRouter.post('/:id/dependencies', async (req, res) => {
  const dto = parse(addDependencySchema, req.body);
  res.status(201).json(await tasksService.addDependency(req.user, req.params.id, dto));
});

// מסיר תלות בין משימות.
// נקרא מ: removeTaskDependency (api.js)
// קורא ל: tasksService.removeDependency
tasksRouter.delete('/:id/dependencies/:dependsOnTaskId', async (req, res) => {
  res.json(await tasksService.removeDependency(req.user, req.params.id, req.params.dependsOnTaskId));
});

// מעדכן את שדות המשימה.
// נקרא מ: updateTask (api.js)
// קורא ל: tasksService.update, parse
tasksRouter.patch('/:id', async (req, res) => {
  res.json(await tasksService.update(req.user, req.params.id, parse(updateTaskSchema, req.body)));
});

// לא רק למנהל פרויקט: עובד רשאי להזיז את הכרטיסים שלו (נבדק בתוך ה-service).
// מעביר משימה לעמודה: הרשאה, מגבלת WIP, חסימות, התראה ואוטומציה.
// נקרא מ: moveTask (api.js)
// קורא ל: tasksService.move, parse
tasksRouter.patch('/:id/move', async (req, res) => {
  res.json(await tasksService.move(req.user, req.params.id, parse(moveSchema, req.body)));
});

// משייך משימה לעובד ושולח לו התראה.
// נקרא מ: assignTask (api.js)
// קורא ל: parse, tasksService.assign
tasksRouter.patch('/:id/assign', async (req, res) => {
  const { assigneeId } = parse(assignSchema, req.body);
  res.json(await tasksService.assign(req.user, req.params.id, assigneeId));
});

// מעביר משימה לארכיון או מחזיר ממנו.
// נקרא מ: archiveTask (api.js)
// קורא ל: parse, tasksService.setArchived
tasksRouter.patch('/:id/archive', async (req, res) => {
  const { archived } = parse(archiveSchema, req.body);
  res.json(await tasksService.setArchived(req.user, req.params.id, archived));
});

// מוחק משימה.
// נקרא מ: deleteTask (api.js)
// קורא ל: tasksService.remove
tasksRouter.delete('/:id', async (req, res) => {
  await tasksService.remove(req.user, req.params.id);
  res.status(204).end();
});
