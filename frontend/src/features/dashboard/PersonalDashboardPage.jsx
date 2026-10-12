// הדשבורד האישי.
// חלקים עיקריים: כרטיסי מדדים, המשימות שלי, הפרויקטים הנוכחיים, התראות אחרונות.

import { useMemo } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { KpiCard } from '../../components/common/KpiCard';
import { TaskRow } from '../../components/common/TaskRow';
import { ProjectCard } from '../../components/common/ProjectCard';
import { EmptyState, LoadingState } from '../../components/common/States';
import { DashboardHero } from './components/DashboardHero';
import { useAuth } from '../../auth/AuthContext';
import { useOrganizationUsers, useProjects, useTasks } from '../../lib/queries';
import { isDueSoon, isOverdue } from '../../lib/taskStatus';
import { formatRelativeToNow } from '../../lib/format';
import { useNotifications } from '../../lib/queries';

// המשימות, הפרויקטים והפעילות של המשתמש.
// נקרא מ: App.jsx
export function PersonalDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: tasks, isLoading: tasksLoading } = useTasks({ assigneeId: user?.id });
  const { data: projects, isLoading: projectsLoading } = useProjects({ memberId: user?.id });
  const { data: users } = useOrganizationUsers();
  const { data: notifications } = useNotifications();

  const stats = useMemo(() => {
    const list = tasks ?? [];
    const assigned = list.length;
    const overdue = list.filter(isOverdue).length;
    const dueSoon = list.filter((t) => isDueSoon(t) && !isOverdue(t)).length;
    const completed = list.filter((t) => t.completedAt).length;
    const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
    const recentlyCompleted = list
      .filter((t) => t.completedAt)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 4);
    const overdueTasks = list.filter(isOverdue).slice(0, 5);
    const dueSoonTasks = list.filter((t) => isDueSoon(t) && !isOverdue(t)).slice(0, 5);
    return { assigned, overdue, dueSoon, completionRate, recentlyCompleted, overdueTasks, dueSoonTasks };
  }, [tasks]);

  const weekly = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);
    const dueThisWeek = (tasks ?? []).filter((t) => t.dueDate && new Date(t.dueDate) >= cutoff && new Date(t.dueDate) <= now);
    const completed = dueThisWeek.filter((t) => t.completedAt).length;
    const total = dueThisWeek.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percent };
  }, [tasks]);

  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);
  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);

  if (tasksLoading || projectsLoading) return <LoadingState label="Loading your dashboard…" />;

  return (
    <Box>
      <PageHeader title="My Dashboard" description="Your assigned work across every project." />

      <DashboardHero
        firstName={user?.firstName ?? 'there'}
        stats={[
          { icon: <EventBusyOutlinedIcon />, value: `${stats.dueSoon} tasks`, label: 'Due soon' },
          { icon: <WarningAmberOutlinedIcon />, value: `${stats.overdue} tasks`, label: 'Overdue' },
          { icon: <TaskAltOutlinedIcon />, value: `${stats.recentlyCompleted.length} tasks`, label: 'Completed recently' },
        ]}
        weeklyGoalPercent={weekly.percent}
        weeklyCompleted={weekly.completed}
        weeklyTotal={weekly.total}
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Assigned Tasks"
            value={stats.assigned}
            icon={<ChecklistOutlinedIcon fontSize="small" />}
            accentColor="#3454D1"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Due Soon"
            value={stats.dueSoon}
            icon={<EventBusyOutlinedIcon fontSize="small" />}
            accentColor="#8A5A00"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Overdue"
            value={stats.overdue}
            icon={<WarningAmberOutlinedIcon fontSize="small" />}
            accentColor="#C62828"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Completion Rate"
            value={`${stats.completionRate}%`}
            icon={<TaskAltOutlinedIcon fontSize="small" />}
            accentColor="#2E7D32"
            helperText="of assigned tasks"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1.5 }}>
                Overdue tasks
              </Typography>
              {stats.overdueTasks.length === 0 ? (
                <EmptyState
                  title="Nothing overdue"
                  description="Great work — you're on top of your deadlines."
                  icon={<TaskAltOutlinedIcon sx={{ fontSize: 40 }} />}
                />
              ) : (
                stats.overdueTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    assignee={userMap.get(t.assigneeId ?? '')}
                    projectName={projectMap.get(t.projectId)?.name}
                    showProject
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1.5 }}>
                Due soon
              </Typography>
              {stats.dueSoonTasks.length === 0 ? (
                <EmptyState title="Nothing due in the next 3 days" />
              ) : (
                stats.dueSoonTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    assignee={userMap.get(t.assigneeId ?? '')}
                    projectName={projectMap.get(t.projectId)?.name}
                    showProject
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1.5 }}>
                Recently completed
              </Typography>
              {stats.recentlyCompleted.length === 0 ? (
                <EmptyState title="No completed tasks yet" description="Tasks you finish will show up here." />
              ) : (
                stats.recentlyCompleted.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    assignee={userMap.get(t.assigneeId ?? '')}
                    projectName={projectMap.get(t.projectId)?.name}
                    showProject
                  />
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h4">Recent notifications</Typography>
                <Button size="small" onClick={() => navigate('/notifications')}>
                  View all
                </Button>
              </Stack>
              {(notifications ?? []).length === 0 ? (
                <EmptyState title="No notifications" />
              ) : (
                <Stack spacing={1.25}>
                  {(notifications ?? []).slice(0, 5).map((n) => (
                    <Box key={n.id} sx={{ pb: 1.25, borderBottom: '1px solid #F0F1F6' }}>
                      <Typography variant="body2" fontWeight={n.read ? 500 : 700}>
                        {n.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {n.body}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatRelativeToNow(n.createdAt, new Date())}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h4">Current projects</Typography>
                <Button size="small" onClick={() => navigate('/projects')}>
                  View all
                </Button>
              </Stack>
              {(projects ?? []).length === 0 ? (
                <EmptyState title="No projects yet" description="You are not a member of any project." />
              ) : (
                <Stack spacing={1.5}>
                  {(projects ?? []).slice(0, 3).map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      manager={userMap.get(p.managerId)}
                      members={p.memberIds.map((id) => userMap.get(id)).filter(Boolean)}
                    />
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
