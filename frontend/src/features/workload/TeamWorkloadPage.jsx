// מסך עומס הצוות.

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend } from 'recharts';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { PageHeader } from '../../components/common/PageHeader';
import { UserIdentity } from '../../components/common/UserAvatar';
import { KpiCard } from '../../components/common/KpiCard';
import { LoadingState, EmptyState } from '../../components/common/States';
import { useOrganizationUsers, useProjects, useWorkloadSummary } from '../../lib/queries';
import { fullName } from '../../lib/format';

const CAPACITY_TASKS = 6; // מספר המשימות שנחשב "קיבולת מלאה" בפס העומס

// כמה משימות פתוחות ושעות יש לכל עובד, ומי מעל הקיבולת.
// נקרא מ: App.jsx
export function TeamWorkloadPage() {
  const [projectFilter, setProjectFilter] = useState('ALL');
  const { data: users, isLoading: usersLoading } = useOrganizationUsers();
  const { data: projects } = useProjects({ scope: 'all' });
  const { data: summaryRows, isLoading: summaryLoading } = useWorkloadSummary(projectFilter === 'ALL' ? undefined : projectFilter);

  const workload = useMemo(() => {
    const userMap = new Map((users ?? []).map((u) => [u.id, u]));
    return (summaryRows ?? [])
      .map((row) => ({
        user: userMap.get(row.userId),
        openCount: row.openCount,
        overdue: row.overdueCount,
        estimated: row.estimatedHours,
      }))
      .filter((w) => !!w.user)
      .sort((a, b) => b.openCount - a.openCount);
  }, [users, summaryRows]);

  const chartData = workload.map((w) => ({ name: w.user.firstName, Open: w.openCount, Overdue: w.overdue }));

  const summary = useMemo(
    () => ({
      members: workload.length,
      totalOpen: workload.reduce((sum, w) => sum + w.openCount, 0),
      overCapacity: workload.filter((w) => w.openCount > CAPACITY_TASKS).length,
      totalOverdue: workload.reduce((sum, w) => sum + w.overdue, 0),
    }),
    [workload],
  );

  if (usersLoading || summaryLoading) return <LoadingState label="Loading team workload…" />;

  return (
    <Box>
      <PageHeader title="Team Workload" description="See how open work is distributed across your team." />

      {workload.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Team Members"
              value={summary.members}
              icon={<GroupsOutlinedIcon fontSize="small" />}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Open Tasks"
              value={summary.totalOpen}
              icon={<ChecklistOutlinedIcon fontSize="small" />}
              accentColor="#2A6FB0"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Over Capacity"
              value={summary.overCapacity}
              icon={<TrendingUpOutlinedIcon fontSize="small" />}
              accentColor="#8A5A00"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Overdue"
              value={summary.totalOverdue}
              icon={<WarningAmberOutlinedIcon fontSize="small" />}
              accentColor="#C62828"
            />
          </Grid>
        </Grid>
      )}

      <TextField
        select
        size="small"
        label="Project"
        value={projectFilter}
        onChange={(e) => setProjectFilter(e.target.value)}
        sx={{ minWidth: 220, mb: 2.5 }}
      >
        <MenuItem value="ALL">All projects</MenuItem>
        {(projects ?? []).map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.name}
          </MenuItem>
        ))}
      </TextField>

      {workload.length === 0 ? (
        <EmptyState title="No open tasks assigned" description="There is currently no assigned open work to distribute." />
      ) : (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1.5 }}>
                  Open tasks per person
                </Typography>
                <Box sx={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F5" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={70} />
                      <ReTooltip />
                      <Legend />
                      <Bar dataKey="Open" fill="#3454D1" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                      <Bar dataKey="Overdue" fill="#C62828" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1.5 }}>
                  Capacity overview
                </Typography>
                <Stack spacing={2}>
                  {workload.map(({ user, openCount, overdue, estimated }) => {
                    const utilization = Math.min(100, Math.round((openCount / CAPACITY_TASKS) * 100));
                    const overCapacity = openCount > CAPACITY_TASKS;
                    return (
                      <Box key={user.id}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                          <UserIdentity user={user} size="small" subtitle={user.title} />
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            {overdue > 0 && <Chip label={`${overdue} overdue`} size="small" color="error" />}
                            {overCapacity && <Chip label="Over capacity" size="small" color="warning" />}
                          </Stack>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={utilization}
                          color={overCapacity ? 'error' : utilization > 70 ? 'warning' : 'primary'}
                          aria-label={`${fullName(user)} capacity utilization`}
                          sx={{ height: 7, borderRadius: 4 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {openCount} open tasks · {estimated}h estimated for {fullName(user)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
