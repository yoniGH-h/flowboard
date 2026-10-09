import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// TanStack Query hooks for every screen: each one wraps a function from api/api.js (the
// Express backend), caches the result, and refreshes the related data after a change.
import * as realApi from '../api/api';
import { useAuth } from '../auth/AuthContext';

export function useOrganizationUsers(filters = {}) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['users', organization?.id, filters],
    queryFn: () => realApi.fetchUsers(organization.id, filters),
    enabled: !!organization,
  });
}

export function useProjects(filters = {}) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['projects', organization?.id, filters],
    queryFn: () => realApi.fetchProjects({ organizationId: organization.id, ...filters }),
    enabled: !!organization,
  });
}

export function useProject(projectId) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => realApi.fetchProject(projectId),
    enabled: !!projectId,
  });
}

export function useBoard(projectId) {
  return useQuery({
    queryKey: ['board', projectId],
    queryFn: () => realApi.fetchBoard(projectId),
    enabled: !!projectId,
  });
}

export function useProjectAttachments(projectId) {
  return useQuery({
    queryKey: ['project-attachments', projectId],
    queryFn: () => realApi.fetchProjectAttachments(projectId),
    enabled: !!projectId,
  });
}

export function useProjectActivity(projectId) {
  return useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: () => realApi.fetchProjectActivity(projectId),
    enabled: !!projectId,
  });
}

export function useTasks(filters = {}) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['tasks', organization?.id, filters],
    queryFn: () => realApi.fetchTasks({ organizationId: organization.id, ...filters }),
    enabled: !!organization,
  });
}

export function useTask(taskId) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => realApi.fetchTask(taskId),
    enabled: !!taskId,
  });
}

export function useTaskActivity(taskId) {
  return useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: () => realApi.fetchTaskActivity(taskId),
    enabled: !!taskId,
  });
}

export function useComments(taskId) {
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => realApi.fetchComments(taskId),
    enabled: !!taskId,
  });
}

export function useAttachments(taskId) {
  return useQuery({
    queryKey: ['attachments', taskId],
    queryFn: () => realApi.fetchAttachments(taskId),
    enabled: !!taskId,
  });
}

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => realApi.fetchNotifications(user.id),
    enabled: !!user,
    // No refetchInterval - useNotificationsSocket keeps this cache fresh via real-time push.
  });
}

export function useAuditLog(filters = {}) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['audit', organization?.id, filters],
    queryFn: () => realApi.fetchAuditLog({ organizationId: organization.id, ...filters }),
    enabled: !!organization,
  });
}

export function useAutomationRules() {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['automation-rules', organization?.id],
    queryFn: () => realApi.fetchAutomationRules(organization.id),
    enabled: !!organization,
  });
}

export function useAutomationExecutions(ruleId) {
  return useQuery({
    queryKey: ['automation-executions', ruleId],
    queryFn: () => realApi.fetchAutomationExecutions(ruleId),
    enabled: !!ruleId,
  });
}

export function useDeleteAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: realApi.deleteAutomationRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

export function useUpdateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, rule }) => realApi.updateAutomationRule(ruleId, rule),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

// ---------- Insights ----------

export function useInsights(projectId) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['insights', organization?.id, projectId],
    queryFn: () => realApi.fetchInsights(projectId),
    enabled: !!organization,
  });
}

export function useRiskHistory(projectId) {
  return useQuery({
    queryKey: ['risk-history', projectId],
    queryFn: () => realApi.fetchRiskHistory(projectId),
    enabled: !!projectId,
  });
}

// ---------- Decision Center ----------

export function usePlanningView(projectId) {
  return useQuery({
    queryKey: ['planning', projectId],
    queryFn: () => realApi.fetchPlanningView(projectId),
    enabled: !!projectId,
  });
}

export function useRecommendations(projectId) {
  return useQuery({
    queryKey: ['recommendations', projectId],
    queryFn: () => realApi.fetchRecommendations(projectId),
    enabled: !!projectId,
  });
}

// What-if: nothing is saved, so this is a mutation only in the "call on demand" sense.
export function useSimulation() {
  return useMutation({ mutationFn: ({ projectId, changes }) => realApi.simulatePlan(projectId, changes) });
}

export function useDecisions(projectId) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['decisions', organization?.id, projectId ?? 'all'],
    queryFn: () => realApi.fetchDecisions(projectId),
    enabled: !!organization,
    retry: false,
  });
}

// Applying a decision really changes tasks / members / dates - refresh everything they feed.
export function useApplyDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, changes, source, note }) => realApi.applyDecision(projectId, { changes, source, note }),
    onSuccess: () => {
      for (const key of ['planning', 'recommendations', 'decisions', 'insights', 'projects', 'project', 'tasks', 'board', 'risk-history']) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

// ---------- Dynamic permissions ----------

export function usePermissionMatrix() {
  // retry: false - on a backend without this endpoint (404) the page falls back right away.
  return useQuery({ queryKey: ['permission-matrix'], queryFn: realApi.fetchPermissionMatrix, retry: false });
}

export function useSetRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleName, key, granted }) => realApi.setRolePermission(roleName, key, granted),
    onSuccess: (matrix) => {
      qc.setQueryData(['permission-matrix'], matrix);
      qc.invalidateQueries({ queryKey: ['user-permissions'] }); // explanations depend on the roles
    },
  });
}

export function useUserPermissions(userId) {
  return useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: () => realApi.fetchUserPermissions(userId),
    enabled: !!userId,
  });
}

export function useSetUserPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, key, granted, expiresAt, reason }) =>
      realApi.setUserPermission(userId, key, { granted, expiresAt, reason }),
    onSuccess: (result, { userId }) => qc.setQueryData(['user-permissions', userId], result),
  });
}

export function useWorkloadSummary(projectId) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['workload-summary', organization?.id, projectId],
    queryFn: () => realApi.fetchWorkloadSummary(projectId),
    enabled: !!organization,
  });
}

export function useDashboardSummary(projectId) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['dashboard-summary', organization?.id, projectId],
    queryFn: () => realApi.fetchDashboardSummary(projectId),
    enabled: !!organization,
  });
}

export function useReportsSummary(filters = {}) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['reports-summary', organization?.id, filters],
    queryFn: () => realApi.fetchReportsSummary(filters),
    enabled: !!organization,
  });
}

export function useLabels() {
  return useQuery({ queryKey: ['labels'], queryFn: realApi.fetchLabels });
}

export function useOrganizations() {
  return useQuery({ queryKey: ['organizations'], queryFn: realApi.fetchOrganizations });
}

export function useAllAuditLog(filters = {}) {
  return useQuery({ queryKey: ['audit-all', filters], queryFn: () => realApi.fetchSystemAuditLog(filters) });
}

// ---------- Mutations ----------

// Board settings: after any change to the columns, refresh the board and the tasks on it.
function useBoardColumnMutation(mutationFn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['board', projectId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useAddBoardColumn() {
  return useBoardColumnMutation(({ projectId, column }) => realApi.addBoardColumn(projectId, column));
}

export function useUpdateBoardColumn() {
  return useBoardColumnMutation(({ projectId, columnId, patch }) => realApi.updateBoardColumn(projectId, columnId, patch));
}

export function useDeleteBoardColumn() {
  return useBoardColumnMutation(({ projectId, columnId }) => realApi.deleteBoardColumn(projectId, columnId));
}

export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, columnId }) => realApi.moveTask(taskId, columnId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, patch }) => realApi.updateTask(taskId, patch),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', variables.taskId] });
      qc.invalidateQueries({ queryKey: ['task-activity', variables.taskId] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: realApi.createTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useArchiveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, archived }) => realApi.archiveTask(taskId, archived),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId) => realApi.deleteTask(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useAddTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnTaskId, type }) => realApi.addTaskDependency(taskId, dependsOnTaskId, type),
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['task', variables.taskId] }),
  });
}

export function useRemoveTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnTaskId }) => realApi.removeTaskDependency(taskId, dependsOnTaskId),
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['task', variables.taskId] }),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, authorId, body }) => realApi.addComment(taskId, authorId, body),
    onSuccess: (_d, variables) => {
      qc.invalidateQueries({ queryKey: ['comments', variables.taskId] });
      qc.invalidateQueries({ queryKey: ['task-activity', variables.taskId] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }) => realApi.updateComment(commentId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId) => realApi.deleteComment(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  });
}

export function useAddAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, file }) => realApi.addAttachment(taskId, file),
    onSuccess: (_d, variables) => {
      qc.invalidateQueries({ queryKey: ['attachments', variables.taskId] });
      qc.invalidateQueries({ queryKey: ['task-activity', variables.taskId] });
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId) => realApi.deleteAttachment(attachmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments'] }),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId) => realApi.markNotificationRead(notificationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => realApi.markAllNotificationsRead(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: realApi.createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, patch }) => realApi.updateProject(projectId, patch),
    onSuccess: (_d, variables) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', variables.projectId] });
    },
  });
}

export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, archived }) => realApi.archiveProject(projectId, archived),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }) => realApi.addProjectMember(projectId, userId),
    onSuccess: (_d, variables) => {
      qc.invalidateQueries({ queryKey: ['project', variables.projectId] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }) => realApi.removeProjectMember(projectId, userId),
    onSuccess: (_d, variables) => qc.invalidateQueries({ queryKey: ['project', variables.projectId] }),
  });
}

export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }) => realApi.setUserStatus(userId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useRemoveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => realApi.removeUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roles }) => realApi.updateUserRoles(userId, roles),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useToggleAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, enabled }) => realApi.toggleAutomationRule(ruleId, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

export function useCreateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: realApi.createAutomationRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, patch }) => realApi.updateUserProfile(userId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, patch }) => realApi.updateOrganization(orgId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}

export function useSetOrganizationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, status }) => realApi.setOrganizationStatus(orgId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}
