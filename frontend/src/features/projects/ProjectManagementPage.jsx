// מסך ניהול הפרויקטים.
// חלקים עיקריים: כרטיסי מדדים, סינון, טבלת הפרויקטים, יצירה ועריכה וארכוב.

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Menu from '@mui/material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { ProjectStatusChip } from '../../components/common/StatusChip';
import { RiskBadge } from '../../components/common/RiskBadge';
import { UserIdentity } from '../../components/common/UserAvatar';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { KpiCard } from '../../components/common/KpiCard';
import { EmptyState, LoadingState, NoSearchResultsState } from '../../components/common/States';
import { useArchiveProject, useOrganizationUsers, useProjects } from '../../lib/queries';
import { ProjectFormDialog } from './ProjectFormDialog';
import { hasPermission, isOrgAdmin, ROLE_LEVEL } from '../../lib/permissions';
import { useAuth } from '../../auth/AuthContext';

// טבלת פרויקטים למנהל: יצירה, עריכה וארכוב.
// נקרא מ: App.jsx
export function ProjectManagementPage() {
  const navigate = useNavigate();
  const { activeRole, user } = useAuth();
  // שליפה לא מסוננת לכרטיסי המדדים (הם מסכמים את כל פרויקטי הארגון, לא את
  // הסינון הנוכחי); ושאילתה נפרדת, מסוננת בשרת, לטבלה.
  const { data: projects, isLoading } = useProjects({ includeArchived: true, scope: 'all' });
  const { data: users } = useOrganizationUsers();
  const archiveProject = useArchiveProject();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(undefined);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);

  const { data: filtered = [] } = useProjects({
    includeArchived: true,
    scope: 'all',
    status: status === 'ALL' ? undefined : status,
    search: search.trim() || undefined,
  });

  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);
  const managers = useMemo(() => (users ?? []).filter((u) => u.roles.some((r) => ROLE_LEVEL[r] >= ROLE_LEVEL.PROJECT_MANAGER)), [users]);

  const summary = useMemo(() => {
    const list = projects ?? [];
    return {
      total: list.length,
      active: list.filter((p) => p.status === 'ACTIVE').length,
      atRisk: list.filter((p) => p.status === 'AT_RISK').length,
      archived: list.filter((p) => p.archived).length,
    };
  }, [projects]);

  if (isLoading) return <LoadingState label="Loading projects…" />;

  return (
    <Box>
      <PageHeader
        title="Project Management"
        description={
          isOrgAdmin(activeRole)
            ? 'Create, edit, and archive projects across your organization.'
            : 'Create, edit, and archive the projects you manage.'
        }
        actions={
          hasPermission(user, 'projects.create') && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingProject(undefined);
                setFormOpen(true);
              }}
            >
              New Project
            </Button>
          )
        }
      />

      {(projects ?? []).length > 0 && (
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Total Projects"
              value={summary.total}
              icon={<FolderOutlinedIcon fontSize="small" />}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Active"
              value={summary.active}
              icon={<PlayCircleOutlineOutlinedIcon fontSize="small" />}
              accentColor="#2A6FB0"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="At Risk"
              value={summary.atRisk}
              icon={<WarningAmberOutlinedIcon fontSize="small" />}
              accentColor="#C62828"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Archived"
              value={summary.archived}
              icon={<ArchiveOutlinedIcon fontSize="small" />}
              accentColor="#6B7080"
            />
          </Grid>
        </Grid>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField
          size="small"
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 240 }}
        />
        <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="ALL">All statuses</MenuItem>
          {['PLANNING', 'ACTIVE', 'AT_RISK', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'].map((s) => (
            <MenuItem key={s} value={s}>
              {s.replace('_', ' ')}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {(projects ?? []).length === 0 ? (
        <EmptyState title="No projects yet" description="Create your first project to get started." />
      ) : filtered.length === 0 ? (
        <NoSearchResultsState
          onClear={() => {
            setSearch('');
            setStatus('ALL');
          }}
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Project</TableCell>
                <TableCell>Manager</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate(`/projects/${p.id}`)}>
                    {p.name}
                  </TableCell>
                  <TableCell>{userMap.get(p.managerId) ? <UserIdentity user={userMap.get(p.managerId)} size="small" /> : '—'}</TableCell>
                  <TableCell>
                    <ProjectStatusChip status={p.status} />
                  </TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    <LinearProgress
                      variant="determinate"
                      value={p.progress}
                      aria-label={`${p.name} progress`}
                      sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
                    />
                    <Box component="span" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                      {p.progress}%
                    </Box>
                  </TableCell>
                  <TableCell>
                    <RiskBadge score={p.riskScore} level={p.riskLevel} compact />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => setMenuAnchor({ el: e.currentTarget, project: p })}
                      aria-label={`Actions for ${p.name}`}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Menu anchorEl={menuAnchor?.el} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            if (menuAnchor) navigate(`/projects/${menuAnchor.project.id}`);
            setMenuAnchor(null);
          }}
        >
          View overview
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) navigate(`/management/projects/${menuAnchor.project.id}/team`);
            setMenuAnchor(null);
          }}
        >
          Manage team
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              setEditingProject(menuAnchor.project);
              setFormOpen(true);
            }
            setMenuAnchor(null);
          }}
        >
          Edit details
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) setConfirmArchive(menuAnchor.project);
            setMenuAnchor(null);
          }}
        >
          {menuAnchor?.project.archived ? 'Restore project' : 'Archive project'}
        </MenuItem>
      </Menu>

      <ProjectFormDialog open={formOpen} onClose={() => setFormOpen(false)} managers={managers} project={editingProject} />

      <ConfirmDialog
        open={!!confirmArchive}
        title={confirmArchive?.archived ? 'Restore project' : 'Archive project'}
        description={
          confirmArchive?.archived
            ? `"${confirmArchive?.name}" will be restored and reappear in active project lists.`
            : `"${confirmArchive?.name}" will be archived and hidden from active project lists. You can restore it later.`
        }
        confirmLabel={confirmArchive?.archived ? 'Restore' : 'Archive'}
        danger={!confirmArchive?.archived}
        onClose={() => setConfirmArchive(null)}
        onConfirm={async () => {
          if (confirmArchive) await archiveProject.mutateAsync({ projectId: confirmArchive.id, archived: !confirmArchive.archived });
          setConfirmArchive(null);
        }}
      />
    </Box>
  );
}
