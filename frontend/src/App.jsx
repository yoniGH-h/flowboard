// טבלת הנתיבים של האתר.

import { Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { ProtectedRoute, RequireRoleLevel } from './auth/ProtectedRoute';
import { AppShell } from './layout/AppShell';
import { ROLE_LEVEL } from './lib/permissions';

import { SignInPage } from './auth/pages/SignInPage';
import { SignUpPage } from './auth/pages/SignUpPage';
import { ForgotPasswordPage } from './auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from './auth/pages/ResetPasswordPage';

const lazyNamed = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));
const PersonalDashboardPage = lazyNamed(() => import('./features/dashboard/PersonalDashboardPage'), 'PersonalDashboardPage');
const ManagementDashboardPage = lazyNamed(() => import('./features/dashboard/ManagementDashboardPage'), 'ManagementDashboardPage');
const MyProjectsPage = lazyNamed(() => import('./features/projects/MyProjectsPage'), 'MyProjectsPage');
const ProjectOverviewPage = lazyNamed(() => import('./features/projects/ProjectOverviewPage'), 'ProjectOverviewPage');
const ProjectManagementPage = lazyNamed(() => import('./features/projects/ProjectManagementPage'), 'ProjectManagementPage');
const ProjectTeamManagementPage = lazyNamed(() => import('./features/projects/ProjectTeamManagementPage'), 'ProjectTeamManagementPage');
const KanbanBoardPage = lazyNamed(() => import('./features/kanban/KanbanBoardPage'), 'KanbanBoardPage');
const MyTasksPage = lazyNamed(() => import('./features/tasks/MyTasksPage'), 'MyTasksPage');
const TaskDetailsPage = lazyNamed(() => import('./features/tasks/TaskDetailsPage'), 'TaskDetailsPage');
const TeamWorkloadPage = lazyNamed(() => import('./features/workload/TeamWorkloadPage'), 'TeamWorkloadPage');
const DecisionCenterPage = lazyNamed(() => import('./features/planning/DecisionCenterPage'), 'DecisionCenterPage');
const ReportsAnalyticsPage = lazyNamed(() => import('./features/reports/ReportsAnalyticsPage'), 'ReportsAnalyticsPage');
const NotificationCenterPage = lazyNamed(() => import('./features/notifications/NotificationCenterPage'), 'NotificationCenterPage');
const ProfileSettingsPage = lazyNamed(() => import('./features/profile/ProfileSettingsPage'), 'ProfileSettingsPage');
const UserManagementPage = lazyNamed(() => import('./features/admin/UserManagementPage'), 'UserManagementPage');
const RolesPermissionsPage = lazyNamed(() => import('./features/admin/RolesPermissionsPage'), 'RolesPermissionsPage');
const OrganizationSettingsPage = lazyNamed(() => import('./features/admin/OrganizationSettingsPage'), 'OrganizationSettingsPage');
const AuditLogPage = lazyNamed(() => import('./features/admin/AuditLogPage'), 'AuditLogPage');
const OrganizationsSystemManagementPage = lazyNamed(() => import('./features/system/OrganizationsSystemManagementPage'), 'OrganizationsSystemManagementPage');

import { NotFoundPage } from './pages/NotFoundPage';
import { ForbiddenPage } from './pages/ForbiddenPage';

// הרכיב הראשי: כל הנתיבים, עם שמירה לפי התחברות ודרג.
// נקרא מ: main.jsx
export default function App() {
  return (
    <Suspense fallback={<Box sx={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}><CircularProgress aria-label="Loading page" /></Box>}>
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<PersonalDashboardPage />} />
          <Route path="/projects" element={<MyProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectOverviewPage />} />
          <Route path="/projects/:projectId/board" element={<KanbanBoardPage />} />
          <Route path="/my-tasks" element={<MyTasksPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailsPage />} />
          <Route path="/notifications" element={<NotificationCenterPage />} />
          <Route path="/profile" element={<ProfileSettingsPage />} />

          <Route
            path="/management/dashboard"
            element={
              <RequireRoleLevel minLevel={ROLE_LEVEL.PROJECT_MANAGER}>
                <ManagementDashboardPage />
              </RequireRoleLevel>
            }
          />
          <Route
            path="/management/projects"
            element={
              <RequireRoleLevel minLevel={ROLE_LEVEL.PROJECT_MANAGER}>
                <ProjectManagementPage />
              </RequireRoleLevel>
            }
          />
          <Route
            path="/management/projects/:projectId/team"
            element={
              <RequireRoleLevel minLevel={ROLE_LEVEL.PROJECT_MANAGER}>
                <ProjectTeamManagementPage />
              </RequireRoleLevel>
            }
          />
          <Route
            path="/management/workload"
            element={
              <RequireRoleLevel minLevel={ROLE_LEVEL.PROJECT_MANAGER}>
                <TeamWorkloadPage />
              </RequireRoleLevel>
            }
          />
          <Route
            path="/management/decisions"
            element={
              <RequireRoleLevel minLevel={ROLE_LEVEL.PROJECT_MANAGER}>
                <DecisionCenterPage />
              </RequireRoleLevel>
            }
          />
          <Route
            path="/management/reports"
            element={
              <RequireRoleLevel minLevel={ROLE_LEVEL.PROJECT_MANAGER}>
                <ReportsAnalyticsPage />
              </RequireRoleLevel>
            }
          />

          <Route
            path="/admin/users"
            element={
              <RequireRoleLevel minLevel={ROLE_LEVEL.ORG_ADMIN}>
                <UserManagementPage />
              </RequireRoleLevel>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <RequireRoleLevel minLevel={ROLE_LEVEL.ORG_ADMIN}>
                <RolesPermissionsPage />
              </RequireRoleLevel>
            }
          />
          <Route
            path="/admin/organization-settings"
            element={
              <RequireRoleLevel minLevel={ROLE_LEVEL.ORG_ADMIN}>
                <OrganizationSettingsPage />
              </RequireRoleLevel>
            }
          />
          <Route
            path="/admin/audit-log"
            element={
              <RequireRoleLevel minLevel={ROLE_LEVEL.ORG_ADMIN}>
                <AuditLogPage />
              </RequireRoleLevel>
            }
          />

          <Route
            path="/system/organizations"
            element={
              <RequireRoleLevel minLevel={ROLE_LEVEL.SYSTEM_ADMIN}>
                <OrganizationsSystemManagementPage />
              </RequireRoleLevel>
            }
          />

          <Route path="/403" element={<ForbiddenPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}
