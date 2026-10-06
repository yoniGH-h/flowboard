import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { PageHeader } from '../../components/common/PageHeader';
import { ProjectStatusChip } from '../../components/common/StatusChip';
import { RiskBadge } from '../../components/common/RiskBadge';
import { UserIdentity, UserAvatarStack } from '../../components/common/UserAvatar';
import { KpiCard } from '../../components/common/KpiCard';
import { EmptyState, LoadingState } from '../../components/common/States';
import { useAuth } from '../../auth/AuthContext';
import { useOrganizationUsers, useProject, useTasks, useProjectAttachments, useProjectActivity } from '../../lib/queries';
import { formatDate, formatDateTime, formatFileSize, fullName } from '../../lib/format';
import { projectAbility } from '../../lib/permissions';
import { ContactButtons } from '../../components/common/ContactButtons';
import { RiskTrendChart } from './RiskTrendChart';

export function ProjectOverviewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const [tab, setTab] = useState('overview');
  const { data: project, isLoading } = useProject(projectId);
  const { data: users } = useOrganizationUsers();
  const { data: tasks } = useTasks({ projectId });
  const { data: files = [] } = useProjectAttachments(projectId);
  const { data: projectActivity = [] } = useProjectActivity(projectId);

  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);

  const taskStats = useMemo(() => {
    const list = tasks ?? [];
    return {
      total: list.length,
      overdue: list.filter((t) => t.dueDate && !t.completedAt && new Date(t.dueDate) < new Date()).length,
      blocked: list.filter((t) => t.blocked).length,
      done: list.filter((t) => t.completedAt).length,
    };
  }, [tasks]);

  if (isLoading) return <LoadingState label="Loading project…" />;
  if (!project) return <NotFoundEntity label="Project" />;

  const manager = userMap.get(project.managerId);
  const members = project.memberIds.map((id) => userMap.get(id)).filter((u) => !!u);

  return (
    <Box>
      <Breadcrumbs items={[{ label: 'My Projects', to: '/projects' }, { label: project.name }]} />
      <PageHeader
        title={project.name}
        description={project.description}
        actions={
          <>
            <Button variant="outlined" startIcon={<ViewKanbanOutlinedIcon />} onClick={() => navigate(`/projects/${project.id}/board`)}>
              Open Board
            </Button>
            {projectAbility(activeRole, project, 'manageMembers') && (
              <Button
                variant="outlined"
                startIcon={<GroupOutlinedIcon />}
                onClick={() => navigate(`/management/projects/${project.id}/team`)}
              >
                Manage Team
              </Button>
            )}
          </>
        }
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatBlock label="Status" content={<ProjectStatusChip status={project.status} />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatBlock label="Risk Level" content={<RiskBadge score={project.riskScore} level={project.riskLevel} compact />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatBlock
            label="Timeline"
            content={
              <Typography variant="body2" fontWeight={600}>
                {formatDate(project.startDate)} – {formatDate(project.targetDate)}
              </Typography>
            }
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatBlock
            label="Progress"
            content={
              <Box sx={{ width: '100%' }}>
                <Typography variant="body2" fontWeight={700}>
                  {project.progress}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={project.progress}
                  aria-label="Project progress"
                  sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                />
              </Box>
            }
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard
            label="Total Tasks"
            value={taskStats.total}
            icon={<ChecklistOutlinedIcon fontSize="small" />}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard
            label="Completed"
            value={taskStats.done}
            icon={<TaskAltOutlinedIcon fontSize="small" />}
            accentColor="#2E7D32"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard
            label="Overdue"
            value={taskStats.overdue}
            icon={<WarningAmberOutlinedIcon fontSize="small" />}
            accentColor="#C62828"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard
            label="Blocked"
            value={taskStats.blocked}
            icon={<BlockOutlinedIcon fontSize="small" />}
            accentColor="#6B7080"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid #E7E7EB' }}>
              <Tab value="overview" label="Overview" />
              <Tab value="files" label={`Files (${files.length})`} />
              <Tab value="activity" label="Activity" />
            </Tabs>
            <CardContent>
              {tab === 'overview' && (
                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="h4" sx={{ mb: 1.5 }}>
                      Delay risk factors
                    </Typography>
                    <Stack spacing={1.25}>
                      {project.riskFactors.map((f) => (
                        <Box key={f.label}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" fontWeight={600}>
                              {f.label}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              +{f.contribution} pts
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {f.detail}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                  <RiskTrendChart projectId={project.id} />
                </Stack>
              )}
              {tab === 'files' &&
                (files.length === 0 ? (
                  <EmptyState
                    icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 40 }} />}
                    title="No files yet"
                    description="Files attached to tasks in this project will appear here."
                  />
                ) : (
                  <List>
                    {files.map((f) => {
                      const uploader = userMap.get(f.uploadedById);
                      return (
                        <ListItem key={f.id} divider>
                          <ListItemAvatar>
                            <Avatar variant="rounded" sx={{ bgcolor: '#EEF0F5', color: 'text.secondary' }}>
                              <InsertDriveFileOutlinedIcon fontSize="small" />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={f.fileName}
                            secondary={`${formatFileSize(f.sizeKb)} · Uploaded by ${uploader ? fullName(uploader) : 'Unknown'} on ${formatDate(f.uploadedAt)}`}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                ))}
              {tab === 'activity' &&
                (projectActivity.length === 0 ? (
                  <EmptyState title="No activity recorded yet" />
                ) : (
                  <Stack spacing={1.5}>
                    {projectActivity.map((entry) => {
                      const actor = userMap.get(entry.actorId);
                      return (
                        <Box key={entry.id} sx={{ pb: 1.5, borderBottom: '1px solid #F0F1F6' }}>
                          <Typography variant="body2">
                            <strong>{actor ? fullName(actor) : 'Unknown'}</strong> — {entry.detail}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(entry.createdAt)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1.5 }}>
                Project manager
              </Typography>
              {manager && <UserIdentity user={manager} subtitle={manager.title} />}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h4">Team ({members.length})</Typography>
                <UserAvatarStack users={members} max={3} />
              </Stack>
              <Stack spacing={1.5}>
                {members.map((m) => (
                  <Stack key={m.id} direction="row" alignItems="center" justifyContent="space-between">
                    <UserIdentity user={m} subtitle={m.title} />
                    <ContactButtons user={m} projectId={project.id} />
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function StatBlock({ label, content }) {
  return (
    <Card>
      <CardContent sx={{ py: 1.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
        <Box sx={{ mt: 1 }}>{content}</Box>
      </CardContent>
    </Card>
  );
}

function NotFoundEntity({ label }) {
  return <EmptyState title={`${label} not found`} description="It may have been removed or you may not have access." />;
}
