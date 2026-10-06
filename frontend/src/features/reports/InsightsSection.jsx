import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts';
import { useInsights } from '../../lib/queries';
import { formatDate, fullName } from '../../lib/format';

const SEVERITY = {
  critical: { icon: <ErrorOutlineIcon fontSize="small" sx={{ color: '#C62828' }} />, label: 'Critical' },
  warning: { icon: <WarningAmberOutlinedIcon fontSize="small" sx={{ color: '#B26A00' }} />, label: 'Warning' },
  info: { icon: <InfoOutlinedIcon fontSize="small" sx={{ color: '#2A6FB0' }} />, label: 'Info' },
};

const FORECAST_STATUS = {
  'on-track': { label: 'On track', color: 'success' },
  late: { label: 'Will be late', color: 'error' },
  slow: { label: 'Too slow', color: 'warning' },
  stalled: { label: 'Stalled', color: 'error' },
  done: { label: 'All done', color: 'default' },
};

// "Insights" on Reports & Analytics: conclusions a manager can act on, computed by the server
// from data FlowBoard already has (see backend-express/src/modules/insights).
export function InsightsSection({ projectId, users }) {
  const { data, isLoading, isError } = useInsights(projectId);
  const navigate = useNavigate();
  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);

  if (isLoading) return null;
  if (isError || !data) return <Alert severity="warning" sx={{ mb: 3 }}>Could not load the key conclusions.</Alert>;

  const { conclusions, forecast, estimates, bottlenecks } = data;

  return (
    <Box sx={{ mb: 3 }}>
      {/* ---------- Key conclusions ---------- */}
      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <LightbulbOutlinedIcon color="primary" />
            <Typography variant="h4">Key conclusions</Typography>
          </Stack>
          {conclusions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nothing needs your attention right now.
            </Typography>
          ) : (
            <List dense disablePadding>
              {conclusions.map((c, i) => {
                const content = (
                  <>
                    <ListItemIcon sx={{ minWidth: 34 }}>{SEVERITY[c.severity].icon}</ListItemIcon>
                    <ListItemText primary={c.text} slotProps={{ primary: { variant: 'body2' } }} />
                  </>
                );
                return c.projectId ? (
                  <ListItemButton key={i} onClick={() => navigate(`/projects/${c.projectId}`)} sx={{ borderRadius: 1 }}>
                    {content}
                  </ListItemButton>
                ) : (
                  <ListItem key={i}>{content}</ListItem>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        {/* ---------- Delivery forecast ---------- */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h4">Delivery forecast</Typography>
              <Typography variant="caption" color="text.secondary">
                Open tasks divided by the pace of the last 4 weeks.
              </Typography>
              <Table size="small" sx={{ mt: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Project</TableCell>
                    <TableCell align="right">Open</TableCell>
                    <TableCell align="right">Done (4 wks)</TableCell>
                    <TableCell>Forecast</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {forecast.map((f) => (
                    <TableRow key={f.projectId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${f.projectId}`)}>
                      <TableCell>{f.name}</TableCell>
                      <TableCell align="right">{f.openTasks}</TableCell>
                      <TableCell align="right">{f.completedLast4Weeks}</TableCell>
                      <TableCell>
                        {f.forecastDate ? formatDate(f.forecastDate) : '—'}
                        {f.daysLate > 0 && (
                          <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                            +{f.daysLate} days
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(f.targetDate)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={FORECAST_STATUS[f.status].label} color={FORECAST_STATUS[f.status].color} variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* ---------- Estimate accuracy ---------- */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h4">Estimate accuracy</Typography>
              <Typography variant="caption" color="text.secondary">
                Actual vs. estimated hours of completed tasks.
              </Typography>
              {estimates.sampleSize === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No completed tasks with both an estimate and actual hours yet.
                </Typography>
              ) : (
                <>
                  <Stack direction="row" spacing={2} alignItems="baseline" sx={{ my: 1.5 }}>
                    <Typography variant="h3" component="p">
                      {estimates.ratio}×
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {estimates.actualHours}h actual / {estimates.estimatedHours}h estimated · {estimates.sampleSize} tasks
                    </Typography>
                  </Stack>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Person</TableCell>
                        <TableCell align="right">Tasks</TableCell>
                        <TableCell align="right">Est. h</TableCell>
                        <TableCell align="right">Actual h</TableCell>
                        <TableCell align="right">Diff.</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {estimates.byAssignee.map((row) => {
                        const diff = row.ratio ? Math.round((row.ratio - 1) * 100) : null;
                        return (
                          <TableRow key={row.userId}>
                            <TableCell>{userMap.get(row.userId) ? fullName(userMap.get(row.userId)) : 'Unknown'}</TableCell>
                            <TableCell align="right">{row.tasks}</TableCell>
                            <TableCell align="right">{row.estimatedHours}</TableCell>
                            <TableCell align="right">{row.actualHours}</TableCell>
                            <TableCell align="right" sx={{ color: diff > 15 ? 'error.main' : diff < -15 ? 'info.main' : 'text.primary' }}>
                              {diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff}%`}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Use this to plan realistic schedules, not to rate people - tasks differ in difficulty.
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ---------- Where work waits ---------- */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h4">Where work waits</Typography>
              <Typography variant="caption" color="text.secondary">
                Average days a task spends in each board stage, from the tasks&apos; move history.
              </Typography>
              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  {bottlenecks.stages.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Not enough move history yet.
                    </Typography>
                  ) : (
                    <Box sx={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bottlenecks.stages} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F5" />
                          <XAxis type="number" unit="d" tick={{ fontSize: 12 }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                          <ReTooltip formatter={(v) => [`${v} days`, 'Average wait']} />
                          <Bar dataKey="avgDays" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                            {bottlenecks.stages.map((s) => (
                              <Cell key={s.name} fill={s.name === bottlenecks.bottleneck?.name ? '#C62828' : '#3454D1'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Stuck the longest ({bottlenecks.stuckCount})
                  </Typography>
                  {bottlenecks.stuckTasks.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No task has been waiting in an active stage for more than a week.
                    </Typography>
                  ) : (
                    <List dense disablePadding>
                      {bottlenecks.stuckTasks.map((t) => (
                        <ListItemButton key={t.taskId} onClick={() => navigate(`/tasks/${t.taskId}`)} sx={{ borderRadius: 1 }}>
                          <ListItemText
                            primary={t.title}
                            secondary={`${t.projectName} · ${userMap.get(t.assigneeId) ? fullName(userMap.get(t.assigneeId)) : 'Unassigned'}`}
                            slotProps={{ primary: { variant: 'body2' } }}
                          />
                          <Chip size="small" label={`${t.daysInColumn}d in ${t.column}`} color="warning" variant="outlined" />
                        </ListItemButton>
                      ))}
                    </List>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
