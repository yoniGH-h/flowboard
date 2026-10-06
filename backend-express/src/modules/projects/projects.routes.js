import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import {
  isoDate,
  nonEmptyString,
  parse,
  ProjectMemberRole,
  ProjectStatus,
  TaskStatusCategory,
  uuid,
} from '../../utils/validate.js';
import * as projectsService from './projects.service.js';

// ---------- Validation ----------

const createProjectSchema = z.strictObject({
  name: nonEmptyString,
  description: z.string(),
  managerId: uuid,
  startDate: isoDate,
  targetDate: isoDate,
  memberIds: z
    .array(uuid)
    .refine((ids) => new Set(ids).size === ids.length, 'memberIds must not contain duplicates')
    .optional(),
});

const updateProjectSchema = z.strictObject({
  name: nonEmptyString.optional(),
  description: z.string().optional(),
  status: ProjectStatus.optional(),
  managerId: uuid.optional(),
  startDate: isoDate.optional(),
  targetDate: isoDate.optional(),
});

const queryProjectsSchema = z.strictObject({
  scope: z.enum(['mine', 'all']).optional(),
  status: ProjectStatus.optional(),
  search: z.string().optional(),
  includeArchived: z.string().optional(),
});

const archiveSchema = z.strictObject({ archived: z.boolean() });

const addMemberSchema = z.strictObject({
  userId: uuid,
  roleOnProject: ProjectMemberRole.optional(),
});

const updateMemberSchema = z.strictObject({ roleOnProject: ProjectMemberRole });

const createColumnSchema = z.strictObject({
  name: nonEmptyString,
  category: TaskStatusCategory,
  wipLimit: z.number().int().min(1).optional(),
});

const updateColumnSchema = z.strictObject({
  name: nonEmptyString.optional(),
  order: z.number().int().min(0).optional(),
  wipLimit: z.number().int().min(1).nullable().optional(), // null = remove the limit
});

// ---------- Routes ----------

// Only creating a project is checked here. Every other action depends on WHICH project it is
// (you may manage your own projects but not someone else's), so the service checks it per
// project with assertProjectPermission.
export const projectsRouter = Router();

projectsRouter.post('/', requirePermission('projects.create'), async (req, res) => {
  res.status(201).json(await projectsService.create(req.user, parse(createProjectSchema, req.body)));
});

projectsRouter.get('/', async (req, res) => {
  res.json(await projectsService.findAll(req.user, parse(queryProjectsSchema, req.query)));
});

projectsRouter.get('/:id', async (req, res) => {
  res.json(await projectsService.findOne(req.user, req.params.id));
});

projectsRouter.patch('/:id', async (req, res) => {
  res.json(await projectsService.update(req.user, req.params.id, parse(updateProjectSchema, req.body)));
});

projectsRouter.patch('/:id/archive', async (req, res) => {
  const { archived } = parse(archiveSchema, req.body);
  res.json(await projectsService.setArchived(req.user, req.params.id, archived));
});

// Members
projectsRouter.post('/:id/members', async (req, res) => {
  res.status(201).json(await projectsService.addMember(req.user, req.params.id, parse(addMemberSchema, req.body)));
});

projectsRouter.patch('/:id/members/:userId', async (req, res) => {
  const dto = parse(updateMemberSchema, req.body);
  res.json(await projectsService.updateMember(req.user, req.params.id, req.params.userId, dto));
});

projectsRouter.delete('/:id/members/:userId', async (req, res) => {
  res.json(await projectsService.removeMember(req.user, req.params.id, req.params.userId));
});

// Project-wide files and activity
projectsRouter.get('/:id/attachments', async (req, res) => {
  res.json(await projectsService.getAttachments(req.user, req.params.id));
});

projectsRouter.get('/:id/activity', async (req, res) => {
  res.json(await projectsService.getActivity(req.user, req.params.id));
});

// Daily delay-risk scores (for the trend chart). ?days=30 by default, at most a year.
projectsRouter.get('/:id/risk-history', async (req, res) => {
  const { days } = parse(z.strictObject({ days: z.coerce.number().int().min(1).max(365).default(30) }), req.query);
  res.json(await projectsService.getRiskHistory(req.user, req.params.id, days));
});

// Kanban board and its columns
projectsRouter.get('/:id/board', async (req, res) => {
  res.json(await projectsService.getBoard(req.user, req.params.id));
});

projectsRouter.post('/:id/board/columns', async (req, res) => {
  res.status(201).json(await projectsService.addColumn(req.user, req.params.id, parse(createColumnSchema, req.body)));
});

projectsRouter.patch('/:id/board/columns/:columnId', async (req, res) => {
  const dto = parse(updateColumnSchema, req.body);
  res.json(await projectsService.updateColumn(req.user, req.params.id, req.params.columnId, dto));
});

projectsRouter.delete('/:id/board/columns/:columnId', async (req, res) => {
  res.json(await projectsService.removeColumn(req.user, req.params.id, req.params.columnId));
});
