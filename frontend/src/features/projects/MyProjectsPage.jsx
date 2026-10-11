// תפקיד הקובץ: מסך "הפרויקטים שלי".
// משתמשים בו: App.jsx

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import SearchIcon from '@mui/icons-material/Search';
import FolderOffOutlinedIcon from '@mui/icons-material/FolderOffOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { ProjectCard } from '../../components/common/ProjectCard';
import { KpiCard } from '../../components/common/KpiCard';
import { EmptyState, LoadingState, NoSearchResultsState } from '../../components/common/States';
import { useAuth } from '../../auth/AuthContext';
import { useOrganizationUsers, useProjects } from '../../lib/queries';
import { isManager } from '../../lib/permissions';

const STATUS_FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'At Risk', value: 'AT_RISK' },
  { label: 'Planning', value: 'PLANNING' },
  { label: 'On Hold', value: 'ON_HOLD' },
  { label: 'Completed', value: 'COMPLETED' },
];

// כרטיסי הפרויקטים שהמשתמש חבר בהם, עם חיפוש.
// נקרא מ: App.jsx
export function MyProjectsPage() {
  const { user, activeRole } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  // שליפה לא מסוננת לכרטיסי המדדים ולמצב הריק "לא חבר באף פרויקט"
  // (הם מסכמים את כל הפרויקטים שאתה חבר בהם, לא את הסינון הנוכחי);
  // ושאילתה נפרדת, מסוננת בשרת, לרשת הכרטיסים.
  const { data: projects, isLoading } = useProjects({ memberId: user?.id });
  const { data: filtered = [] } = useProjects({
    memberId: user?.id,
    status: status === 'ALL' ? undefined : status,
    search: search.trim() || undefined,
  });
  const { data: users } = useOrganizationUsers();
  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);

  const summary = useMemo(() => {
    const list = projects ?? [];
    return {
      total: list.length,
      active: list.filter((p) => p.status === 'ACTIVE').length,
      atRisk: list.filter((p) => p.status === 'AT_RISK').length,
      completed: list.filter((p) => p.status === 'COMPLETED').length,
    };
  }, [projects]);

  if (isLoading) return <LoadingState label="Loading your projects…" />;

  return (
    <Box>
      <PageHeader
        title="My Projects"
        description="Projects you are a member of."
        actions={
          isManager(activeRole) ? (
            <Button variant="outlined" onClick={() => navigate('/management/projects')}>
              Manage projects
            </Button>
          ) : undefined
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
              label="Completed"
              value={summary.completed}
              icon={<TaskAltOutlinedIcon fontSize="small" />}
              accentColor="#2E7D32"
            />
          </Grid>
        </Grid>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }} alignItems={{ sm: 'center' }}>
        <TextField
          size="small"
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              size="small"
              onClick={() => setStatus(f.value)}
              color={status === f.value ? 'primary' : 'default'}
              variant={status === f.value ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>
      </Stack>

      {(projects ?? []).length === 0 ? (
        <EmptyState
          icon={<FolderOffOutlinedIcon sx={{ fontSize: 44 }} />}
          title="You're not part of any project yet"
          description="Once a project manager adds you to a project, it will appear here."
        />
      ) : filtered.length === 0 ? (
        <NoSearchResultsState
          onClear={() => {
            setSearch('');
            setStatus('ALL');
          }}
        />
      ) : (
        <Grid container spacing={2}>
          {filtered.map((p) => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <ProjectCard
                project={p}
                manager={userMap.get(p.managerId)}
                members={p.memberIds.map((id) => userMap.get(id)).filter(Boolean)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
