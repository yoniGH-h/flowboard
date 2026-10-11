// תפקיד הקובץ: הגדרת תפריט הצד.
// משתמשים בו: Sidebar.jsx

import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import DomainOutlinedIcon from '@mui/icons-material/DomainOutlined';
import PsychologyAltOutlinedIcon from '@mui/icons-material/PsychologyAltOutlined';
import { ROLE_LEVEL } from '../lib/permissions';

// הפריטים בתפריט, והדרג המינימלי שרואה כל אחד.
// נקרא מ: Sidebar.jsx
export const NAV_SECTIONS = [
  {
    title: 'Workspace',
    minLevel: ROLE_LEVEL.EMPLOYEE,
    items: [
      { label: 'My Dashboard', path: '/dashboard', icon: <SpaceDashboardOutlinedIcon fontSize="small" />, minLevel: ROLE_LEVEL.EMPLOYEE },
      { label: 'My Projects', path: '/projects', icon: <FolderOutlinedIcon fontSize="small" />, minLevel: ROLE_LEVEL.EMPLOYEE },
      { label: 'My Tasks', path: '/my-tasks', icon: <ChecklistOutlinedIcon fontSize="small" />, minLevel: ROLE_LEVEL.EMPLOYEE },
      {
        label: 'Notifications',
        path: '/notifications',
        icon: <NotificationsNoneOutlinedIcon fontSize="small" />,
        minLevel: ROLE_LEVEL.EMPLOYEE,
      },
    ],
  },
  {
    title: 'Management',
    minLevel: ROLE_LEVEL.PROJECT_MANAGER,
    items: [
      {
        label: 'Management Dashboard',
        path: '/management/dashboard',
        icon: <InsightsOutlinedIcon fontSize="small" />,
        minLevel: ROLE_LEVEL.PROJECT_MANAGER,
      },
      {
        label: 'Project Management',
        path: '/management/projects',
        icon: <AssessmentOutlinedIcon fontSize="small" />,
        minLevel: ROLE_LEVEL.PROJECT_MANAGER,
      },
      {
        label: 'Team Workload',
        path: '/management/workload',
        icon: <GroupsOutlinedIcon fontSize="small" />,
        minLevel: ROLE_LEVEL.PROJECT_MANAGER,
      },
      {
        label: 'Decision Center',
        path: '/management/decisions',
        icon: <PsychologyAltOutlinedIcon fontSize="small" />,
        minLevel: ROLE_LEVEL.PROJECT_MANAGER,
      },
      {
        label: 'Reports & Analytics',
        path: '/management/reports',
        icon: <BarChartOutlinedIcon fontSize="small" />,
        minLevel: ROLE_LEVEL.PROJECT_MANAGER,
      },
    ],
  },
  {
    title: 'Organization',
    minLevel: ROLE_LEVEL.ORG_ADMIN,
    items: [
      { label: 'User Management', path: '/admin/users', icon: <PeopleAltOutlinedIcon fontSize="small" />, minLevel: ROLE_LEVEL.ORG_ADMIN },
      {
        label: 'Roles & Permissions',
        path: '/admin/roles',
        icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
        minLevel: ROLE_LEVEL.ORG_ADMIN,
      },
      {
        label: 'Organization Settings',
        path: '/admin/organization-settings',
        icon: <SettingsOutlinedIcon fontSize="small" />,
        minLevel: ROLE_LEVEL.ORG_ADMIN,
      },
      { label: 'Audit Log', path: '/admin/audit-log', icon: <HistoryOutlinedIcon fontSize="small" />, minLevel: ROLE_LEVEL.ORG_ADMIN },
    ],
  },
  {
    title: 'Platform',
    minLevel: ROLE_LEVEL.SYSTEM_ADMIN,
    items: [
      {
        label: 'Organizations & System',
        path: '/system/organizations',
        icon: <DomainOutlinedIcon fontSize="small" />,
        minLevel: ROLE_LEVEL.SYSTEM_ADMIN,
      },
    ],
  },
];
