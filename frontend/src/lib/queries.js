// תפקיד הקובץ: כל ה-hooks של TanStack Query: קריאות עם מטמון, ושינויים עם רענון.
// משתמשים בו: AuditLogPage.jsx, AutomationRulesPanel.jsx, OrganizationSettingsPage.jsx, RolesPermissionsPage.jsx +29

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// ה-hooks של TanStack Query לכל המסכים: כל אחד עוטף פונקציה מ-api/api.js,
// שומר את התוצאה במטמון, ומרענן את הנתונים הקשורים אחרי שינוי.
import * as realApi from '../api/api';
import { useAuth } from '../auth/AuthContext';

// קריאה: משתמשי הארגון.
// נקרא מ: AuditLogPage.jsx, AutomationRulesPanel.jsx, UserManagementPage.jsx, ManagementDashboardPage.jsx +10
export function useOrganizationUsers(filters = {}) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['users', organization?.id, filters],
    queryFn: () => realApi.fetchUsers(organization.id, filters),
    enabled: !!organization,
  });
}

// קריאה: רשימת הפרויקטים.
// נקרא מ: AutomationRulesPanel.jsx, ManagementDashboardPage.jsx, PersonalDashboardPage.jsx, DecisionCenterPage.jsx +6
export function useProjects(filters = {}) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['projects', organization?.id, filters],
    queryFn: () => realApi.fetchProjects({ organizationId: organization.id, ...filters }),
    enabled: !!organization,
  });
}

// קריאה: פרויקט אחד.
// נקרא מ: KanbanBoardPage.jsx, ProjectOverviewPage.jsx, ProjectTeamManagementPage.jsx, TaskDetailsPage.jsx
export function useProject(projectId) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => realApi.fetchProject(projectId),
    enabled: !!projectId,
  });
}

// קריאה: הלוח של פרויקט.
// נקרא מ: KanbanBoardPage.jsx, TaskDetailsPage.jsx
export function useBoard(projectId) {
  return useQuery({
    queryKey: ['board', projectId],
    queryFn: () => realApi.fetchBoard(projectId),
    enabled: !!projectId,
  });
}

// קריאה: הקבצים של פרויקט.
// נקרא מ: ProjectOverviewPage.jsx
export function useProjectAttachments(projectId) {
  return useQuery({
    queryKey: ['project-attachments', projectId],
    queryFn: () => realApi.fetchProjectAttachments(projectId),
    enabled: !!projectId,
  });
}

// קריאה: הפעילות של פרויקט.
// נקרא מ: ProjectOverviewPage.jsx
export function useProjectActivity(projectId) {
  return useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: () => realApi.fetchProjectActivity(projectId),
    enabled: !!projectId,
  });
}

// קריאה: משימות לפי סינון.
// נקרא מ: PersonalDashboardPage.jsx, KanbanBoardPage.jsx, ProjectOverviewPage.jsx, MyTasksPage.jsx +2
export function useTasks(filters = {}) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['tasks', organization?.id, filters],
    queryFn: () => realApi.fetchTasks({ organizationId: organization.id, ...filters }),
    enabled: !!organization,
  });
}

// קריאה: משימה אחת.
// נקרא מ: TaskDetailsPage.jsx
export function useTask(taskId) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => realApi.fetchTask(taskId),
    enabled: !!taskId,
  });
}

// קריאה: היסטוריית משימה.
// נקרא מ: TaskDetailsPage.jsx
export function useTaskActivity(taskId) {
  return useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: () => realApi.fetchTaskActivity(taskId),
    enabled: !!taskId,
  });
}

// קריאה: התגובות של משימה.
// נקרא מ: TaskDetailsPage.jsx
export function useComments(taskId) {
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => realApi.fetchComments(taskId),
    enabled: !!taskId,
  });
}

// קריאה: הקבצים של משימה.
// נקרא מ: TaskDetailsPage.jsx
export function useAttachments(taskId) {
  return useQuery({
    queryKey: ['attachments', taskId],
    queryFn: () => realApi.fetchAttachments(taskId),
    enabled: !!taskId,
  });
}

// קריאה: ההתראות של המשתמש.
// נקרא מ: PersonalDashboardPage.jsx, NotificationCenterPage.jsx, NotificationBell.jsx, Sidebar.jsx
export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => realApi.fetchNotifications(user.id),
    enabled: !!user,
    // בלי refetchInterval - useNotificationsSocket שומר על המטמון הזה מעודכן בזמן אמת.
  });
}

// קריאה: יומן הביקורת של הארגון.
// נקרא מ: AuditLogPage.jsx, ManagementDashboardPage.jsx
export function useAuditLog(filters = {}) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['audit', organization?.id, filters],
    queryFn: () => realApi.fetchAuditLog({ organizationId: organization.id, ...filters }),
    enabled: !!organization,
  });
}

// קריאה: חוקי האוטומציה.
// נקרא מ: AutomationRulesPanel.jsx
export function useAutomationRules() {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['automation-rules', organization?.id],
    queryFn: () => realApi.fetchAutomationRules(organization.id),
    enabled: !!organization,
  });
}

// קריאה: היסטוריית ההרצות של חוק.
// נקרא מ: AutomationRulesPanel.jsx
export function useAutomationExecutions(ruleId) {
  return useQuery({
    queryKey: ['automation-executions', ruleId],
    queryFn: () => realApi.fetchAutomationExecutions(ruleId),
    enabled: !!ruleId,
  });
}

// שינוי: מחיקת חוק אוטומציה.
// נקרא מ: AutomationRulesPanel.jsx
export function useDeleteAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: realApi.deleteAutomationRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

// שינוי: עדכון חוק אוטומציה.
// נקרא מ: AutomationRulesPanel.jsx
export function useUpdateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, rule }) => realApi.updateAutomationRule(ruleId, rule),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

// ---------- תובנות ----------

// קריאה: התובנות של פרויקט.
// נקרא מ: InsightsSection.jsx
export function useInsights(projectId) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['insights', organization?.id, projectId],
    queryFn: () => realApi.fetchInsights(projectId),
    enabled: !!organization,
  });
}

// קריאה: ציוני הסיכון היומיים.
// נקרא מ: RiskTrendChart.jsx
export function useRiskHistory(projectId) {
  return useQuery({
    queryKey: ['risk-history', projectId],
    queryFn: () => realApi.fetchRiskHistory(projectId),
    enabled: !!projectId,
  });
}

// ---------- מרכז ההחלטות ----------

// קריאה: תמונת המצב למרכז ההחלטות.
// נקרא מ: DecisionCenterPage.jsx
export function usePlanningView(projectId) {
  return useQuery({
    queryKey: ['planning', projectId],
    queryFn: () => realApi.fetchPlanningView(projectId),
    enabled: !!projectId,
  });
}

// קריאה: ההמלצות לפרויקט.
// נקרא מ: RecommendationsPanel.jsx
export function useRecommendations(projectId) {
  return useQuery({
    queryKey: ['recommendations', projectId],
    queryFn: () => realApi.fetchRecommendations(projectId),
    enabled: !!projectId,
  });
}

// "מה אם": שום דבר לא נשמר, ולכן זו mutation רק במובן של "קריאה לפי דרישה".
// חישוב סימולציה בשרת; לא שומר דבר.
// נקרא מ: SimulatorPanel.jsx
export function useSimulation() {
  return useMutation({ mutationFn: ({ projectId, changes }) => realApi.simulatePlan(projectId, changes) });
}

// קריאה: ההחלטות שבוצעו.
// נקרא מ: DecisionLogPanel.jsx
export function useDecisions(projectId) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['decisions', organization?.id, projectId ?? 'all'],
    queryFn: () => realApi.fetchDecisions(projectId),
    enabled: !!organization,
    retry: false,
  });
}

// ביצוע החלטה באמת משנה משימות, חברי צוות ותאריכים - מרעננים את כל מה שניזון מהם.
// שינוי: ביצוע החלטה, ורענון כל מה שהושפע.
// נקרא מ: ApplyDecisionDialog.jsx
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

// ---------- הרשאות דינמיות ----------

// קריאה: טבלת ההרשאות לפי תפקיד.
// נקרא מ: RolesPermissionsPage.jsx, UserPermissionsDialog.jsx
export function usePermissionMatrix() {
  // retry: false - אם הנתיב לא קיים בשרת (404), העמוד עובר מיד לתצוגה החלופית.
  return useQuery({ queryKey: ['permission-matrix'], queryFn: realApi.fetchPermissionMatrix, retry: false });
}

// שינוי: הרשאה של תפקיד.
// נקרא מ: RolesPermissionsPage.jsx
export function useSetRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleName, key, granted }) => realApi.setRolePermission(roleName, key, granted),
    onSuccess: (matrix) => {
      qc.setQueryData(['permission-matrix'], matrix);
      qc.invalidateQueries({ queryKey: ['user-permissions'] }); // ההסברים תלויים בתפקידים
    },
  });
}

// קריאה: ההרשאות של משתמש.
// נקרא מ: UserPermissionsDialog.jsx
export function useUserPermissions(userId) {
  return useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: () => realApi.fetchUserPermissions(userId),
    enabled: !!userId,
  });
}

// שינוי: חריג הרשאה למשתמש.
// נקרא מ: UserPermissionsDialog.jsx
export function useSetUserPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, key, granted, expiresAt, reason }) =>
      realApi.setUserPermission(userId, key, { granted, expiresAt, reason }),
    onSuccess: (result, { userId }) => qc.setQueryData(['user-permissions', userId], result),
  });
}

// קריאה: סיכום עומס הצוות.
// נקרא מ: ManagementDashboardPage.jsx, TeamWorkloadPage.jsx
export function useWorkloadSummary(projectId) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['workload-summary', organization?.id, projectId],
    queryFn: () => realApi.fetchWorkloadSummary(projectId),
    enabled: !!organization,
  });
}

// קריאה: נתוני הדשבורד הניהולי.
// נקרא מ: ManagementDashboardPage.jsx
export function useDashboardSummary(projectId) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['dashboard-summary', organization?.id, projectId],
    queryFn: () => realApi.fetchDashboardSummary(projectId),
    enabled: !!organization,
  });
}

// קריאה: נתוני מסך הדוחות.
// נקרא מ: ReportsAnalyticsPage.jsx
export function useReportsSummary(filters = {}) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ['reports-summary', organization?.id, filters],
    queryFn: () => realApi.fetchReportsSummary(filters),
    enabled: !!organization,
  });
}

// קריאה: התוויות של הארגון.
// נקרא מ: KanbanBoardPage.jsx, TaskDetailsPage.jsx
export function useLabels() {
  return useQuery({ queryKey: ['labels'], queryFn: realApi.fetchLabels });
}

// קריאה: כל הארגונים.
// נקרא מ: OrganizationsSystemManagementPage.jsx
export function useOrganizations() {
  return useQuery({ queryKey: ['organizations'], queryFn: realApi.fetchOrganizations });
}

// קריאה: יומן הביקורת של כל הארגונים.
// נקרא מ: OrganizationsSystemManagementPage.jsx
export function useAllAuditLog(filters = {}) {
  return useQuery({ queryKey: ['audit-all', filters], queryFn: () => realApi.fetchSystemAuditLog(filters) });
}

// ---------- שינויים (Mutations) ----------

// הגדרות הלוח: אחרי כל שינוי בעמודות, מרעננים את הלוח ואת המשימות שבו.
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

// שינוי: הוספת עמודה ללוח.
// נקרא מ: BoardSettingsDialog.jsx
export function useAddBoardColumn() {
  return useBoardColumnMutation(({ projectId, column }) => realApi.addBoardColumn(projectId, column));
}

// שינוי: עדכון עמודה.
// נקרא מ: BoardSettingsDialog.jsx
export function useUpdateBoardColumn() {
  return useBoardColumnMutation(({ projectId, columnId, patch }) => realApi.updateBoardColumn(projectId, columnId, patch));
}

// שינוי: מחיקת עמודה.
// נקרא מ: BoardSettingsDialog.jsx
export function useDeleteBoardColumn() {
  return useBoardColumnMutation(({ projectId, columnId }) => realApi.deleteBoardColumn(projectId, columnId));
}

// שינוי: הזזת משימה לעמודה, ורענון המשימות.
// נקרא מ: KanbanBoardPage.jsx
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

// שינוי: עדכון משימה.
// נקרא מ: TaskDetailsPage.jsx
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

// שינוי: יצירת משימה.
// נקרא מ: TaskFormDialog.jsx
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

// שינוי: ארכוב משימה.
// נקרא מ: TaskDetailsPage.jsx
export function useArchiveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, archived }) => realApi.archiveTask(taskId, archived),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

// שינוי: מחיקת משימה.
// נקרא מ: TaskDetailsPage.jsx
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId) => realApi.deleteTask(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

// שינוי: הוספת תלות.
// נקרא מ: TaskDetailsPage.jsx
export function useAddTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnTaskId, type }) => realApi.addTaskDependency(taskId, dependsOnTaskId, type),
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['task', variables.taskId] }),
  });
}

// שינוי: הסרת תלות.
// נקרא מ: TaskDetailsPage.jsx
export function useRemoveTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnTaskId }) => realApi.removeTaskDependency(taskId, dependsOnTaskId),
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['task', variables.taskId] }),
  });
}

// שינוי: הוספת תגובה.
// נקרא מ: TaskDetailsPage.jsx
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

// שינוי: עריכת תגובה.
// נקרא מ: TaskDetailsPage.jsx
export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }) => realApi.updateComment(commentId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  });
}

// שינוי: מחיקת תגובה.
// נקרא מ: TaskDetailsPage.jsx
export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId) => realApi.deleteComment(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  });
}

// שינוי: העלאת קובץ.
// נקרא מ: TaskDetailsPage.jsx
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

// שינוי: מחיקת קובץ.
// נקרא מ: אין שימוש כרגע
export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId) => realApi.deleteAttachment(attachmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments'] }),
  });
}

// שינוי: סימון התראה כנקראה.
// נקרא מ: NotificationCenterPage.jsx, NotificationBell.jsx
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId) => realApi.markNotificationRead(notificationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// שינוי: סימון כל ההתראות כנקראו.
// נקרא מ: NotificationCenterPage.jsx, NotificationBell.jsx
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => realApi.markAllNotificationsRead(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// שינוי: יצירת פרויקט.
// נקרא מ: ProjectFormDialog.jsx
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: realApi.createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

// שינוי: עדכון פרויקט.
// נקרא מ: ProjectFormDialog.jsx
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

// שינוי: ארכוב פרויקט.
// נקרא מ: ProjectManagementPage.jsx
export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, archived }) => realApi.archiveProject(projectId, archived),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

// שינוי: הוספת חבר צוות.
// נקרא מ: ProjectTeamManagementPage.jsx
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

// שינוי: הסרת חבר צוות.
// נקרא מ: ProjectTeamManagementPage.jsx
export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }) => realApi.removeProjectMember(projectId, userId),
    onSuccess: (_d, variables) => qc.invalidateQueries({ queryKey: ['project', variables.projectId] }),
  });
}

// שינוי: סטטוס משתמש.
// נקרא מ: UserManagementPage.jsx
export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }) => realApi.setUserStatus(userId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// שינוי: הסרת משתמש.
// נקרא מ: UserManagementPage.jsx
export function useRemoveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => realApi.removeUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// שינוי: תפקידי משתמש.
// נקרא מ: UserManagementPage.jsx
export function useUpdateUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roles }) => realApi.updateUserRoles(userId, roles),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// שינוי: הפעלה או כיבוי של חוק.
// נקרא מ: AutomationRulesPanel.jsx
export function useToggleAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, enabled }) => realApi.toggleAutomationRule(ruleId, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

// שינוי: יצירת חוק אוטומציה.
// נקרא מ: AutomationRulesPanel.jsx
export function useCreateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: realApi.createAutomationRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

// שינוי: עדכון הפרופיל.
// נקרא מ: ProfileSettingsPage.jsx
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, patch }) => realApi.updateUserProfile(userId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// שינוי: הגדרות הארגון.
// נקרא מ: OrganizationSettingsPage.jsx
export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, patch }) => realApi.updateOrganization(orgId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}

// שינוי: סטטוס ארגון.
// נקרא מ: OrganizationsSystemManagementPage.jsx
export function useSetOrganizationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, status }) => realApi.setOrganizationStatus(orgId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  });
}
