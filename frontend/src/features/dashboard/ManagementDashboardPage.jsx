// הדשבורד הניהולי.
// חלקים עיקריים: כרטיסי מדדים, בריאות הפרויקטים, עומס, מגמת ההשלמה, משימות בעדיפות גבוהה.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Checkbox from '@mui/material/Checkbox';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { PageHeader } from '../../components/common/PageHeader';
import { KpiCard } from '../../components/common/KpiCard';
import { PriorityChip } from '../../components/common/PriorityChip';
import { UserAvatar } from '../../components/common/UserAvatar';
import { LoadingState } from '../../components/common/States';
import { ActivityFeed } from './components/ActivityFeed';
import { DashboardHero } from './components/DashboardHero';
import { useAuditLog, useDashboardSummary, useOrganizationUsers, useProjects, useWorkloadSummary } from '../../lib/queries';
import { formatDateShort, fullName } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';

const HEALTH_COLORS = { onTrack: '#2E7D32', atRisk: '#C62828', offTrack: '#8A5A00' };

// מדדים, גרפים ופרויקטים בסיכון, למנהלים.
// נקרא מ: App.jsx
export function ManagementDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: projects, isLoading: projectsLoading } = useProjects({ scope: 'all' });
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: workloadRows, isLoading: workloadLoading } = useWorkloadSummary();
  const { data: users } = useOrganizationUsers();
  const { data: auditLog } = useAuditLog({});

  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);

  const activeProjects = useMemo(() => (projects ?? []).filter((p) => !p.archived), [projects]);

  const health = useMemo(() => {
    const relevant = activeProjects.filter((p) => p.status !== 'COMPLETED');
    const onTrack = relevant.filter((p) => p.status === 'ACTIVE');
    const atRisk = relevant.filter((p) => p.status === 'AT_RISK');
    const offTrack = relevant.filter((p) => p.status === 'PLANNING' || p.status === 'ON_HOLD');
    return { relevant, onTrack, atRisk, offTrack };
  }, [activeProjects]);

  const healthPieData = [
    { name: 'On track', value: health.onTrack.length, color: HEALTH_COLORS.onTrack },
    { name: 'At risk', value: health.atRisk.length, color: HEALTH_COLORS.atRisk },
    { name: 'Off track', value: health.offTrack.length, color: HEALTH_COLORS.offTrack },
  ].filter((d) => d.value > 0);

  const priorityTasks = summary?.priorityTasks ?? [];

  const workload = useMemo(() => {
    return (workloadRows ?? [])
      .map((row) => ({ user: userMap.get(row.userId), count: row.openCount }))
      .filter((w) => !!w.user)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [workloadRows, userMap]);

  const weekly = summary?.weekly ?? { completed: 0, total: 0, percent: 0 };

  const statusPieData = summary
    ? [
        { name: 'Done', value: summary.done, color: '#2E7D32' },
        { name: 'In Progress', value: summary.inProgress, color: '#2A6FB0' },
        { name: 'Blocked', value: summary.blocked, color: '#C62828' },
        { name: 'Overdue', value: summary.overdueExclBlocked, color: '#8A5A00' },
      ].filter((d) => d.value > 0)
    : [];

  // נתונים שבועיים אמיתיים מהשרת: אחוז המשימות שהמועד שלהן הגיע בכל שבוע מול האחוז שהושלם בפועל.
  const completionTrend = summary?.completionTrend ?? [];

  const auditEntries = auditLog ?? [];

  if (projectsLoading || summaryLoading || workloadLoading) return <LoadingState label="Loading management dashboard…" />;

  return (
    <Box>
      <PageHeader
        title="Management Dashboard"
        description="Portfolio-wide view across all your projects."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/management/projects')}>
            New Project
          </Button>
        }
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8.5 }}>
          <DashboardHero
            firstName={user?.firstName ?? 'there'}
            subtitle="Here's your portfolio at a glance."
            stats={[
              { icon: <TaskAltOutlinedIcon />, value: `${priorityTasks.length} priority tasks`, label: 'Focus' },
              { icon: <WarningAmberOutlinedIcon />, value: `${health.atRisk.length} projects`, label: 'At risk' },
              { icon: <TrendingUpOutlinedIcon />, value: `${health.onTrack.length} projects`, label: 'On track' },
            ]}
            weeklyGoalPercent={weekly.percent}
            weeklyCompleted={weekly.completed}
            weeklyTotal={weekly.total}
          />

          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <KpiCard
                label="Active Projects"
                value={activeProjects.length}
                icon={<AssessmentOutlinedIcon fontSize="small" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <KpiCard
                label="Open Tasks"
                value={summary?.open ?? 0}
                icon={<ChecklistOutlinedIcon fontSize="small" />}
                accentColor="#2A6FB0"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <KpiCard
                label="Overdue Tasks"
                value={summary?.overdue ?? 0}
                icon={<WarningAmberOutlinedIcon fontSize="small" />}
                accentColor="#C62828"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <KpiCard
                label="Blocked Tasks"
                value={summary?.blocked ?? 0}
                icon={<BlockOutlinedIcon fontSize="small" />}
                accentColor="#8A5A00"
              />
            </Grid>
          </Grid>

          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="h4">Project health</Typography>
                    <Typography
                      variant="body2"
                      color="primary.main"
                      sx={{ cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => navigate('/management/projects')}
                    >
                      View all
                    </Typography>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <Box sx={{ width: 150, height: 150, flexShrink: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={healthPieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={44}
                            outerRadius={70}
                            paddingAngle={3}
                            cornerRadius={4}
                            isAnimationActive={false}
                          >
                            {healthPieData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <ReTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                    <Box sx={{ flex: 1, width: '100%' }}>
                      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                        {healthPieData.map((d) => (
                          <Stack key={d.name} direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: d.color }} />
                            <Typography variant="caption" color="text.secondary">
                              {d.name} ({d.value})
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Project</TableCell>
                            <TableCell>Progress</TableCell>
                            <TableCell align="right">Due</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {health.relevant.slice(0, 4).map((p) => (
                            <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                              <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                              <TableCell sx={{ minWidth: 90 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={p.progress}
                                  aria-label={`${p.name} progress`}
                                  sx={{ height: 5, borderRadius: 3 }}
                                />
                              </TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                                {formatDateShort(p.targetDate)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography variant="h4">Priority tasks</Typography>
                    <Typography
                      variant="body2"
                      color="primary.main"
                      sx={{ cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => navigate('/my-tasks')}
                    >
                      View all
                    </Typography>
                  </Stack>
                  <Stack spacing={0.5}>
                    {priorityTasks.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No urgent or high-priority tasks open right now.
                      </Typography>
                    )}
                    {priorityTasks.map((t) => (
                      <Stack
                        key={t.id}
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        sx={{ py: 0.75, borderBottom: '1px solid #F0F1F4', cursor: 'pointer' }}
                        onClick={() => navigate(`/tasks/${t.id}`)}
                      >
                        <Checkbox checked={false} size="small" disabled sx={{ p: 0.5 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {t.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            {t.projectName} · {formatDateShort(t.dueDate)}
                          </Typography>
                        </Box>
                        <PriorityChip priority={t.priority} />
                        <UserAvatar user={t.assigneeId ? userMap.get(t.assigneeId) : null} size="small" />
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography variant="h4">Workload</Typography>
                    <Typography
                      variant="body2"
                      color="primary.main"
                      sx={{ cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => navigate('/management/workload')}
                    >
                      View team
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    {workload.map(({ user: member, count }) => {
                      const level = count >= 6 ? 'High' : count >= 3 ? 'Medium' : 'Low';
                      const color = count >= 6 ? 'error' : count >= 3 ? 'warning' : 'success';
                      return (
                        <Stack key={member.id} direction="row" alignItems="center" spacing={1.5}>
                          <UserAvatar user={member} size="small" />
                          <Typography variant="body2" sx={{ width: 110, flexShrink: 0 }} noWrap>
                            {fullName(member)}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, count * 15)}
                            color={color}
                            aria-label={`${fullName(member)} workload`}
                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" color={`${color}.main`} fontWeight={700} sx={{ width: 46, textAlign: 'right' }}>
                            {level}
                          </Typography>
                        </Stack>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h4" sx={{ mb: 1.5 }}>
                    Risks &amp; blockers
                  </Typography>
                  <Stack spacing={1}>
                    {health.atRisk.length > 0 && (
                      <RiskRow
                        icon={<WarningAmberIcon sx={{ fontSize: 18 }} />}
                        color="#C62828"
                        title={`${health.atRisk.length} project${health.atRisk.length > 1 ? 's' : ''} at risk`}
                        detail={health.atRisk.map((p) => p.name).join(', ')}
                        onClick={() => navigate('/management/projects')}
                      />
                    )}
                    {(summary?.overdue ?? 0) > 0 && (
                      <RiskRow
                        icon={<ScheduleOutlinedIcon sx={{ fontSize: 18 }} />}
                        color="#8A5A00"
                        title={`${summary.overdue} task${summary.overdue > 1 ? 's' : ''} overdue`}
                        detail={summary?.oldestOverdueTitle ? `Oldest: ${summary.oldestOverdueTitle}` : undefined}
                        onClick={() => navigate('/my-tasks')}
                      />
                    )}
                    {(summary?.blocked ?? 0) > 0 && (
                      <RiskRow
                        icon={<BlockOutlinedIcon sx={{ fontSize: 18 }} />}
                        color="#6B7080"
                        title={`${summary.blocked} task${summary.blocked > 1 ? 's' : ''} blocked`}
                        detail={summary?.exampleBlockedTitle ?? undefined}
                        onClick={() => navigate('/my-tasks')}
                      />
                    )}
                    {health.atRisk.length === 0 && (summary?.overdue ?? 0) === 0 && (summary?.blocked ?? 0) === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No active risks or blockers — nice work.
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={2.5} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h4" sx={{ mb: 1.5 }}>
                    Tasks by status
                  </Typography>
                  <Box sx={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <defs>
                          {statusPieData.map((entry, idx) => (
                            <linearGradient key={entry.name} id={`taskStatusGrad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                              <stop offset="100%" stopColor={entry.color} stopOpacity={0.65} />
                            </linearGradient>
                          ))}
                        </defs>
                        <Pie
                          data={statusPieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={54}
                          outerRadius={82}
                          paddingAngle={3}
                          cornerRadius={6}
                          isAnimationActive={false}
                        >
                          {statusPieData.map((entry, idx) => (
                            <Cell key={entry.name} fill={`url(#taskStatusGrad-${idx})`} stroke="none" />
                          ))}
                        </Pie>
                        <Legend />
                        <ReTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h4">Completion trend (planned vs. actual)</Typography>
                  <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5 }}>
                    Last 8 weeks: share of tasks that were due by each week (planned) vs. share actually completed.
                  </Typography>
                  <Box sx={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={completionTrend}>
                        <defs>
                          <linearGradient id="mgmtCompletedFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3454D1" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#3454D1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F5" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12 }} unit="%" axisLine={false} tickLine={false} />
                        <ReTooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="planned"
                          name="Planned"
                          stroke="#C7CCDC"
                          strokeDasharray="4 4"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="completed"
                          name="Completed"
                          stroke="#3454D1"
                          strokeWidth={2.5}
                          fill="url(#mgmtCompletedFill)"
                          dot={{ r: 3, fill: '#3454D1', strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        <Grid size={{ xs: 12, lg: 3.5 }}>
          <Box sx={{ position: { lg: 'sticky' }, top: 80 }}>
            <ActivityFeed entries={auditEntries} userMap={userMap} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

function RiskRow({ icon, color, title, detail, onClick }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.25}
      onClick={onClick}
      sx={{ p: 1.25, borderRadius: 1, cursor: 'pointer', border: '1px solid #EFEFF2', '&:hover': { backgroundColor: '#FAFAFB' } }}
    >
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600}>
          {title}
        </Typography>
        {detail && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {detail}
          </Typography>
        )}
      </Box>
      <IconButton size="small" disableRipple sx={{ color: 'text.disabled' }}>
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
