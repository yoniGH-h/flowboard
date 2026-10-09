// Real API layer for Projects, Project Members, Boards, Tasks, Comments, Attachments,
// Labels, and the org member directory - backed by the Express backend.
import { http, getErrorMessage } from './http';

function isNotFound(error) {
  return error?.response?.status === 404;
}

// ---------- Users ----------
export async function fetchUsers(_organizationId, filters = {}) {
  const params = { pageSize: 100 };
  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  const { data } = await http.get('/users', { params });
  return data.items;
}

export async function updateUserProfile(_userId, patch) {
  const { data } = await http.patch('/users/me', patch);
  return data;
}

export async function setUserStatus(userId, status) {
  try {
    const { data } = await http.patch(`/users/${userId}/status`, { status });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function updateUserRoles(userId, roles) {
  try {
    const { data } = await http.patch(`/users/${userId}/roles`, { roles });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function removeUser(userId) {
  try {
    await http.delete(`/users/${userId}`);
    return true;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

// ---------- Roles & permissions ----------
// ---------- Projects ----------
function mapProject(p) {
  return {
    id: p.id,
    organizationId: p.organizationId,
    name: p.name,
    description: p.description,
    status: p.status,
    managerId: p.managerId,
    memberIds: p.members.map((m) => m.id),
    startDate: p.startDate,
    targetDate: p.targetDate,
    progress: p.progress,
    boardId: p.boardId ?? '',
    createdAt: p.createdAt,
    archived: p.archived,
    riskScore: p.riskScore,
    riskLevel: p.riskLevel,
    riskFactors: p.riskFactors,
    // Computed by the server: may the signed-in user manage this project? (Org Admins: every
    // project; Project Managers: only the projects they manage.)
    canManage: !!p.canManage,
    // Fine-grained abilities for this project - see projectAbility() in lib/permissions.js.
    can: p.can,
  };
}

export async function fetchProjects(filters = {}) {
  const params = { scope: filters.scope ?? 'mine' };
  if (filters.status) params.status = filters.status;
  if (filters.search) params.search = filters.search;
  if (filters.includeArchived) params.includeArchived = 'true';

  const { data } = await http.get('/projects', { params });
  let list = data.map(mapProject);
  if (filters.managerId) list = list.filter((p) => p.managerId === filters.managerId);
  return list;
}

export async function fetchProject(projectId) {
  try {
    const { data } = await http.get(`/projects/${projectId}`);
    return mapProject(data);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function createProject(input) {
  try {
    const { data } = await http.post('/projects', {
      name: input.name,
      description: input.description,
      managerId: input.managerId,
      startDate: input.startDate,
      targetDate: input.targetDate,
      memberIds: input.memberIds,
    });
    return mapProject(data);
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function updateProject(projectId, patch) {
  try {
    const { data } = await http.patch(`/projects/${projectId}`, {
      name: patch.name,
      description: patch.description,
      status: patch.status,
      managerId: patch.managerId,
      startDate: patch.startDate,
      targetDate: patch.targetDate,
    });
    return mapProject(data);
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function archiveProject(projectId, archived) {
  const { data } = await http.patch(`/projects/${projectId}/archive`, { archived });
  return mapProject(data);
}

export async function addProjectMember(projectId, userId) {
  try {
    const { data } = await http.post(`/projects/${projectId}/members`, { userId });
    return mapProject(data);
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function removeProjectMember(projectId, userId) {
  const { data } = await http.delete(`/projects/${projectId}/members/${userId}`);
  return mapProject(data);
}

export async function fetchBoard(projectId) {
  try {
    const { data } = await http.get(`/projects/${projectId}/board`);
    return data;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

// ---------- Board columns (Board settings - the project's manager) ----------
// Each call returns the whole board again, so the screen can show it right away.

export async function addBoardColumn(projectId, column) {
  try {
    const { data } = await http.post(`/projects/${projectId}/board/columns`, column);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function updateBoardColumn(projectId, columnId, patch) {
  try {
    const { data } = await http.patch(`/projects/${projectId}/board/columns/${columnId}`, patch);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function deleteBoardColumn(projectId, columnId) {
  try {
    const { data } = await http.delete(`/projects/${projectId}/board/columns/${columnId}`);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function fetchProjectAttachments(projectId) {
  const { data } = await http.get(`/projects/${projectId}/attachments`);
  return data;
}

export async function fetchProjectActivity(projectId) {
  const { data } = await http.get(`/projects/${projectId}/activity`);
  return data;
}

// ---------- Tasks ----------
function mapTask(t) {
  return {
    id: t.id,
    projectId: t.projectId,
    columnId: t.columnId,
    title: t.title,
    description: t.description,
    assigneeId: t.assigneeId,
    creatorId: t.creatorId,
    priority: t.priority,
    startDate: t.startDate,
    dueDate: t.dueDate,
    estimatedHours: t.estimatedHours,
    actualHours: t.actualHours,
    labelIds: t.labels.map((l) => l.id),
    dependencies: t.dependsOnTaskIds ?? t.dependsOn?.map((d) => d.dependsOnTaskId) ?? [],
    dependedOnBy: t.dependedOnBy ?? [],
    parentTaskId: t.parentTaskId ?? null,
    parentTask: t.parentTask ?? null,
    subtasks: t.subtasks ?? [],
    blocked: t.blocked,
    archived: t.archived,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    completedAt: t.completedAt,
    columnCategory: t.column.category,
  };
}

export async function fetchTasks(filters = {}) {
  const params = { pageSize: 100 };
  if (filters.projectId) params.projectId = filters.projectId;
  if (filters.assigneeId) params.assigneeId = filters.assigneeId;
  if (filters.status) params.status = filters.status;
  if (filters.priority) params.priority = filters.priority;
  if (filters.overdueOnly) params.overdue = 'true';
  if (filters.blockedOnly) params.blocked = 'true';
  if (filters.search) params.search = filters.search;
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.sortDir) params.sortDir = filters.sortDir;

  const { data } = await http.get('/tasks', { params });
  return data.items.map(mapTask);
}

export async function fetchTask(taskId) {
  try {
    const { data } = await http.get(`/tasks/${taskId}`);
    return mapTask(data);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function createTask(input) {
  try {
    const { data } = await http.post('/tasks', {
      projectId: input.projectId,
      columnId: input.columnId,
      title: input.title,
      description: input.description,
      assigneeId: input.assigneeId ?? undefined,
      priority: input.priority,
      dueDate: input.dueDate ?? undefined,
      estimatedHours: input.estimatedHours ?? undefined,
      labelIds: input.labelIds,
      parentTaskId: input.parentTaskId ?? undefined,
    });
    return mapTask(data);
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function addTaskDependency(taskId, dependsOnTaskId, type = 'BLOCKS') {
  const { data } = await http.post(`/tasks/${taskId}/dependencies`, { dependsOnTaskId, type });
  return data;
}

export async function removeTaskDependency(taskId, dependsOnTaskId) {
  await http.delete(`/tasks/${taskId}/dependencies/${dependsOnTaskId}`);
  return true;
}

export async function moveTask(taskId, columnId) {
  try {
    const { data } = await http.patch(`/tasks/${taskId}/move`, { columnId });
    return mapTask(data);
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function assignTask(taskId, assigneeId) {
  try {
    const { data } = await http.patch(`/tasks/${taskId}/assign`, { assigneeId });
    return mapTask(data);
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function updateTask(taskId, patch) {
  if (Object.prototype.hasOwnProperty.call(patch, 'columnId')) {
    return moveTask(taskId, patch.columnId);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'assigneeId')) {
    return assignTask(taskId, patch.assigneeId ?? null);
  }
  try {
    const { data } = await http.patch(`/tasks/${taskId}`, {
      title: patch.title,
      description: patch.description,
      priority: patch.priority,
      startDate: patch.startDate ?? undefined,
      dueDate: patch.dueDate ?? undefined,
      estimatedHours: patch.estimatedHours ?? undefined,
      actualHours: patch.actualHours ?? undefined,
      blocked: patch.blocked,
      labelIds: patch.labelIds,
    });
    return mapTask(data);
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function archiveTask(taskId, archived) {
  const { data } = await http.patch(`/tasks/${taskId}/archive`, { archived });
  return mapTask(data);
}

export async function deleteTask(taskId) {
  await http.delete(`/tasks/${taskId}`);
  return true;
}

// Server-side rollup for Team Workload - counts/sums computed by the database
// (Prisma groupBy) rather than fetched-and-reduced client-side.
export async function fetchWorkloadSummary(projectId) {
  const { data } = await http.get('/tasks/workload-summary', { params: projectId ? { projectId } : {} });
  return data;
}

// Server-side rollup for the Management Dashboard - status/priority/weekly-completion
// counts computed by the database rather than fetched-and-reduced client-side.
export async function fetchDashboardSummary(projectId) {
  const { data } = await http.get('/tasks/dashboard-summary', { params: projectId ? { projectId } : {} });
  return data;
}

// Server-side rollup for Reports & Analytics - project/assignee/date-range filters and the
// completion/on-time/per-user stats computed by the database rather than fetched-and-reduced
// client-side. `userActivity` always reflects the whole project scope (unaffected by the
// assignee/date filters), matching the "User activity report" table's long-standing behavior.
export async function fetchReportsSummary(filters = {}) {
  const params = {};
  if (filters.projectId) params.projectId = filters.projectId;
  if (filters.assigneeId) params.assigneeId = filters.assigneeId;
  if (filters.days) params.days = filters.days;
  const { data } = await http.get('/tasks/reports-summary', { params });
  return data;
}

export async function fetchTaskActivity(taskId) {
  const { data } = await http.get(`/tasks/${taskId}/activity`);
  return data;
}

// ---------- Comments ----------
export async function fetchComments(taskId) {
  const { data } = await http.get(`/tasks/${taskId}/comments`);
  return data;
}

export async function addComment(taskId, _authorId, body) {
  try {
    const { data } = await http.post(`/tasks/${taskId}/comments`, { body });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function updateComment(commentId, body) {
  try {
    const { data } = await http.patch(`/comments/${commentId}`, { body });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function deleteComment(commentId) {
  await http.delete(`/comments/${commentId}`);
  return true;
}

// ---------- Attachments ----------
export async function fetchAttachments(taskId) {
  const { data } = await http.get(`/tasks/${taskId}/attachments`);
  return data;
}

const MAX_UPLOAD_MB = 10;

export async function addAttachment(taskId, file) {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new Error(`File exceeds the maximum allowed size of ${MAX_UPLOAD_MB} MB`);
  }
  const form = new FormData();
  form.append('file', file);
  try {
    const { data } = await http.post(`/tasks/${taskId}/attachments`, form);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

// Downloads require the JWT bearer header, so a plain <a href> won't work -
// fetch as a blob (via the authenticated axios instance) and trigger a client-side save.
export async function downloadAttachment(attachmentId, fileName) {
  const response = await http.get(`/attachments/${attachmentId}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function deleteAttachment(attachmentId) {
  await http.delete(`/attachments/${attachmentId}`);
  return true;
}

// ---------- Labels ----------
export async function fetchLabels() {
  const { data } = await http.get('/labels');
  return data;
}

// ---------- Audit log ----------
// Server only supports pagination + organization scoping today (see
// docs/future-improvements.md: "server-side search/filter/sort" is a follow-up),
// so action/actor/search filters are applied client-side, same as fetchUsers above.
function formatAuditMetadata(metadata) {
  const entries = Object.entries(metadata ?? {});
  if (entries.length === 0) return '';
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(', ');
}

function mapAuditLogEntry(entry) {
  return {
    id: entry.id,
    organizationId: entry.organizationId,
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    createdAt: entry.createdAt,
    metadata: formatAuditMetadata(entry.metadata),
  };
}

export async function fetchAuditLog(filters = {}) {
  const params = { pageSize: 100 };
  if (filters.action) params.action = filters.action;
  if (filters.actorId) params.actorId = filters.actorId;
  if (filters.entityType) params.entityType = filters.entityType;
  if (filters.search) params.search = filters.search;
  const { data } = await http.get('/audit-log', { params });
  return data.items.map(mapAuditLogEntry);
}

// System Administrator scope - a cross-org feed backed by GET /audit-log/system, which
// (unlike the org-scoped endpoint above) also joins each entry's organization name.
export async function fetchSystemAuditLog(filters = {}) {
  const params = { pageSize: 100 };
  if (filters.action) params.action = filters.action;
  if (filters.actorId) params.actorId = filters.actorId;
  if (filters.entityType) params.entityType = filters.entityType;
  if (filters.search) params.search = filters.search;
  const { data } = await http.get('/audit-log/system', { params });
  return data.items.map((entry) => ({
    ...mapAuditLogEntry(entry),
    actorName: entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : 'System',
    organizationName: entry.organization?.name ?? 'Unknown organization',
  }));
}

// ---------- Organizations ----------
export async function updateOrganization(_orgId, patch) {
  try {
    const { data } = await http.patch('/organizations/current', patch);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

// ---------- Organizations (System Administrator scope) ----------
export async function fetchOrganizations() {
  const { data } = await http.get('/organizations');
  return data;
}

export async function setOrganizationStatus(orgId, status) {
  const { data } = await http.patch(`/organizations/${orgId}/status`, { status });
  return data;
}

// ---------- Notifications ----------
export function mapNotification(n) {
  return {
    id: n.id,
    organizationId: n.organizationId,
    userId: n.userId,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    createdAt: n.createdAt,
    relatedProjectId: n.relatedProjectId ?? undefined,
    relatedTaskId: n.relatedTaskId ?? undefined,
    actionUrl: n.actionUrl ?? undefined, // e.g. the Zoom join link of a meeting invite
  };
}

export async function fetchNotifications(_userId) {
  const { data } = await http.get('/notifications');
  return data.map(mapNotification);
}

export async function markNotificationRead(notificationId) {
  try {
    const { data } = await http.patch(`/notifications/${notificationId}/read`);
    return mapNotification(data);
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function markAllNotificationsRead(_userId) {
  await http.patch('/notifications/read-all');
  return true;
}

// ---------- Automation Rules ----------
export async function fetchAutomationRules(_organizationId) {
  const { data } = await http.get('/automation-rules');
  return data;
}

export async function toggleAutomationRule(ruleId, enabled) {
  try {
    const { data } = await http.patch(`/automation-rules/${ruleId}/toggle`, { enabled });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

// `rule.organizationId` is accepted (the panel still sends it, mirroring the mock signature)
// but dropped before the request - the backend always derives the organization from the
// caller's JWT, and the endpoint's ValidationPipe rejects unknown body fields.
export async function createAutomationRule(rule) {
  try {
    const { data } = await http.post('/automation-rules', {
      projectId: rule.projectId ?? undefined,
      name: rule.name,
      enabled: rule.enabled,
      trigger: rule.trigger,
      condition: rule.condition,
      action: rule.action,
    });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function updateAutomationRule(ruleId, rule) {
  const { data } = await http.patch(`/automation-rules/${ruleId}`, {
    projectId: rule.projectId ?? null,
    name: rule.name,
    enabled: rule.enabled,
    trigger: rule.trigger,
    condition: rule.condition,
    action: rule.action,
  });
  return data;
}

export async function deleteAutomationRule(ruleId) {
  await http.delete(`/automation-rules/${ruleId}`);
  return true;
}

export async function fetchAutomationExecutions(ruleId) {
  const { data } = await http.get(`/automation-rules/${ruleId}/executions`);
  return data;
}

// ---------- Insights (Express backend) ----------

// Forecast, estimate accuracy, where work waits, risk trend + plain-language conclusions.
export async function fetchInsights(projectId) {
  const { data } = await http.get('/insights', { params: projectId ? { projectId } : {} });
  return data;
}

// Daily delay-risk scores of one project: [{ day, riskScore, riskLevel }]
export async function fetchRiskHistory(projectId, days = 30) {
  const { data } = await http.get(`/projects/${projectId}/risk-history`, { params: { days } });
  return data;
}

// ---------- Decision Center (Express backend) ----------
// changes = { reassign: [{ taskId, toUserId }], deferTaskIds, addMemberIds, unblockTaskIds, newTargetDate }

export async function fetchPlanningView(projectId) {
  const { data } = await http.get(`/planning/projects/${projectId}`);
  return data;
}

export async function simulatePlan(projectId, changes) {
  try {
    const { data } = await http.post(`/planning/projects/${projectId}/simulate`, { changes });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function fetchRecommendations(projectId) {
  const { data } = await http.get(`/planning/projects/${projectId}/recommendations`);
  return data;
}

export async function applyDecision(projectId, { changes, source, note }) {
  try {
    const { data } = await http.post(`/planning/projects/${projectId}/decisions`, { changes, source, note: note || undefined });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function fetchDecisions(projectId) {
  const { data } = await http.get('/planning/decisions', { params: projectId ? { projectId } : {} });
  return data;
}

// ---------- Permissions (dynamic: role matrix + per-employee exceptions) ----------

export async function fetchPermissionMatrix() {
  const { data } = await http.get('/permissions/matrix');
  return data;
}

// granted: true = give the role this permission, false = take it away, null = back to default
export async function setRolePermission(roleName, key, granted) {
  try {
    const { data } = await http.put(`/permissions/roles/${roleName}/${key}`, { granted });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

export async function fetchUserPermissions(userId) {
  const { data } = await http.get(`/permissions/users/${userId}`);
  return data;
}

// granted: true = extra permission, false = removed permission, null = remove the exception
export async function setUserPermission(userId, key, { granted, expiresAt, reason }) {
  try {
    const { data } = await http.put(`/permissions/users/${userId}/${key}`, {
      granted,
      expiresAt: expiresAt || undefined,
      reason: reason || undefined,
    });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
}

// ---------- Meetings (Zoom voice / video calls) ----------
// The server creates a Zoom meeting and notifies the invitee. Returns { startUrl, joinUrl }:
// startUrl opens the meeting as host for the caller.
export async function startMeeting({ inviteeId, mode, projectId, taskId }) {
  try {
    const { data } = await http.post('/meetings', { inviteeId, mode, projectId, taskId });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to start the call.'), { cause: error });
  }
}
