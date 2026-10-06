import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend } from 'recharts';
import { PageHeader } from '../../components/common/PageHeader';
import { KpiCard } from '../../components/common/KpiCard';
import { ProjectStatusChip } from '../../components/common/StatusChip';
import { RiskBadge } from '../../components/common/RiskBadge';
import { LoadingState } from '../../components/common/States';
import { useOrganizationUsers, useProjects, useReportsSummary } from '../../lib/queries';
import { fullName } from '../../lib/format';
import { buildSparkline } from '../../lib/trends';
import { InsightsSection } from './InsightsSection';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

const DATE_RANGES = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'All time', value: 0 },
];

export function ReportsAnalyticsPage() {
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState('ALL');
  const [range, setRange] = useState(30);

  const { data: projects, isLoading: projectsLoading } = useProjects({ scope: 'all' });
  const { data: users } = useOrganizationUsers();
  const { data: summary, isLoading: summaryLoading } = useReportsSummary({
    projectId: projectFilter === 'ALL' ? undefined : projectFilter,
    assigneeId: userFilter === 'ALL' ? undefined : userFilter,
    days: range,
  });

  const plannedVsCompleted = useMemo(
    () =>
      (projects ?? [])
        .filter((p) => projectFilter === 'ALL' || p.id === projectFilter)
        .map((p) => ({ name: p.name.length > 14 ? `${p.name.slice(0, 14)}…` : p.name, Planned: 100, Completed: p.progress })),
    [projects, projectFilter],
  );

  const userActivity = useMemo(() => {
    const userMap = new Map((users ?? []).map((u) => [u.id, u]));
    return (summary?.userActivity ?? [])
      .map((row) => ({ user: userMap.get(row.userId), assigned: row.assigned, completed: row.completed, rate: row.rate }))
      .filter((row) => !!row.user);
  }, [summary, users]);

  if (projectsLoading || summaryLoading || !summary) return <LoadingState label="Loading reports…" />;

  return (
    <Box>
      <PageHeader title="Reports & Analytics" description="Progress, completion, and activity reporting across your projects." />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField
          select
          size="small"
          label="Project"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="ALL">All projects</MenuItem>
          {(projects ?? []).map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="User"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="ALL">All users</MenuItem>
          {(users ?? []).map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {fullName(u)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Date range"
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
          sx={{ minWidth: 160 }}
        >
          {DATE_RANGES.map((r) => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <InsightsSection projectId={projectFilter === 'ALL' ? undefined : projectFilter} users={users} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Tasks in Scope"
            value={summary.total}
            icon={<TaskAltOutlinedIcon fontSize="small" />}
            sparkline={buildSparkline(summary.total, 6, 1)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Completed"
            value={summary.completed}
            icon={<TrendingUpOutlinedIcon fontSize="small" />}
            accentColor="#2E7D32"
            sparkline={buildSparkline(summary.completed, 6, 2)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Avg. Completion Time"
            value={`${summary.avgCompletionDays}d`}
            icon={<ScheduleOutlinedIcon fontSize="small" />}
            accentColor="#2A6FB0"
            sparkline={buildSparkline(summary.avgCompletionDays, 6, 3)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Overdue"
            value={summary.overdue}
            icon={<WarningAmberOutlinedIcon fontSize="small" />}
            accentColor="#C62828"
            helperText={`${summary.onTimeRate}% on-time completion`}
            sparkline={buildSparkline(summary.overdue, 6, 4)}
          />
        </Grid>
      </Grid>

      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Typography variant="h4" sx={{ mb: 1.5 }}>
            Planned vs. completed progress
          </Typography>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plannedVsCompleted}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F5" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis unit="%" tick={{ fontSize: 12 }} />
                <ReTooltip />
                <Legend />
                <Bar dataKey="Planned" fill="#DCE1F5" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Completed" fill="#3454D1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1.5 }}>
                Project progress report
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Project</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Progress</TableCell>
                      <TableCell align="right">Risk</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(projects ?? [])
                      .filter((p) => projectFilter === 'ALL' || p.id === projectFilter)
                      .map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>
                            <ProjectStatusChip status={p.status} />
                          </TableCell>
                          <TableCell align="right">{p.progress}%</TableCell>
                          <TableCell align="right">
                            <RiskBadge score={p.riskScore} level={p.riskLevel} compact />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1.5 }}>
                User activity report
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell align="right">Assigned</TableCell>
                      <TableCell align="right">Completed</TableCell>
                      <TableCell align="right">Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userActivity.map((row) => (
                      <TableRow key={row.user.id}>
                        <TableCell>{fullName(row.user)}</TableCell>
                        <TableCell align="right">{row.assigned}</TableCell>
                        <TableCell align="right">{row.completed}</TableCell>
                        <TableCell align="right">{row.rate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
