// תפקיד הקובץ: מסך "המשימות שלי".
// משתמשים בו: App.jsx

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import useMediaQuery from '@mui/material/useMediaQuery';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Paper from '@mui/material/Paper';
import SearchIcon from '@mui/icons-material/Search';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { PriorityChip } from '../../components/common/PriorityChip';
import { ColumnCategoryChip } from '../../components/common/StatusChip';
import { TaskRow } from '../../components/common/TaskRow';
import { KpiCard } from '../../components/common/KpiCard';
import { EmptyState, LoadingState, NoSearchResultsState } from '../../components/common/States';
import { useAuth } from '../../auth/AuthContext';
import { useOrganizationUsers, useProjects, useTasks } from '../../lib/queries';
import { isDueSoon, isOverdue } from '../../lib/taskStatus';
import { formatDateShort } from '../../lib/format';

// המשימות שמשויכות למשתמש, עם סינון ומיון.
// נקרא מ: App.jsx
export function MyTasksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:900px)');
  // Unfiltered fetch for the KPI cards and the "no tasks at all" empty state (they
  // summarize every task assigned to you, not the current filter selection); a
  // separately-filtered, server-side query for the table rows.
  const { data: tasks, isLoading } = useTasks({ assigneeId: user?.id });
  const { data: projects } = useProjects({ memberId: user?.id });
  const { data: users } = useOrganizationUsers();

  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [conditionFilter, setConditionFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState('dueDate');
  const [sortDir, setSortDir] = useState('asc');

  const { data: filtered = [] } = useTasks({
    assigneeId: user?.id,
    projectId: projectFilter === 'ALL' ? undefined : projectFilter,
    priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    overdueOnly: conditionFilter === 'OVERDUE' ? true : undefined,
    blockedOnly: conditionFilter === 'BLOCKED' ? true : undefined,
    search: search.trim() || undefined,
    sortBy: sortKey,
    sortDir,
  });

  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);
  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);

  const columnCategoryOf = (task) => task.columnCategory;

  const summary = useMemo(() => {
    const list = tasks ?? [];
    return {
      assigned: list.length,
      overdue: list.filter(isOverdue).length,
      dueSoon: list.filter((t) => isDueSoon(t) && !isOverdue(t)).length,
      blocked: list.filter((t) => t.blocked).length,
    };
  }, [tasks]);

  if (isLoading) return <LoadingState label="Loading your tasks…" />;

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const hasActiveFilters =
    search || projectFilter !== 'ALL' || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || conditionFilter !== 'ALL';
  const clearFilters = () => {
    setSearch('');
    setProjectFilter('ALL');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setConditionFilter('ALL');
  };

  return (
    <Box>
      <PageHeader title="My Tasks" description="All tasks assigned to you across every project." />

      {(tasks ?? []).length > 0 && (
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Assigned"
              value={summary.assigned}
              icon={<ChecklistOutlinedIcon fontSize="small" />}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Due Soon"
              value={summary.dueSoon}
              icon={<EventBusyOutlinedIcon fontSize="small" />}
              accentColor="#8A5A00"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Overdue"
              value={summary.overdue}
              icon={<WarningAmberOutlinedIcon fontSize="small" />}
              accentColor="#C62828"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Blocked"
              value={summary.blocked}
              icon={<BlockOutlinedIcon fontSize="small" />}
              accentColor="#6B7080"
            />
          </Grid>
        </Grid>
      )}

      <Stack direction="row" spacing={1.5} sx={{ mb: 2.5 }} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField
          size="small"
          placeholder="Search my tasks…"
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
          sx={{ minWidth: 220 }}
        />
        <TextField
          select
          size="small"
          label="Project"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          sx={{ minWidth: 160 }}
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
          label="Priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="ALL">All priorities</MenuItem>
          {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
            <MenuItem key={p} value={p}>
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="ALL">All statuses</MenuItem>
          <MenuItem value="TODO">To Do</MenuItem>
          <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
          <MenuItem value="REVIEW">In Review</MenuItem>
          <MenuItem value="DONE">Done</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Condition"
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="ALL">All tasks</MenuItem>
          <MenuItem value="OVERDUE">Overdue</MenuItem>
          <MenuItem value="BLOCKED">Blocked</MenuItem>
        </TextField>
      </Stack>

      {(tasks ?? []).length === 0 ? (
        <EmptyState title="No tasks assigned to you" description="When you're assigned a task, it will show up here." />
      ) : filtered.length === 0 ? (
        <NoSearchResultsState onClear={hasActiveFilters ? clearFilters : undefined} />
      ) : isMobile ? (
        <Stack>
          {filtered.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              assignee={userMap.get(t.assigneeId ?? '')}
              projectName={projectMap.get(t.projectId)?.name}
              showProject
            />
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell>Task</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>
                  <TableSortLabel active={sortKey === 'priority'} direction={sortDir} onClick={() => handleSort('priority')}>
                    Priority
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel active={sortKey === 'dueDate'} direction={sortDir} onClick={() => handleSort('dueDate')}>
                    Due Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel active={sortKey === 'updatedAt'} direction={sortDir} onClick={() => handleSort('updatedAt')}>
                    Updated
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((t) => {
                const overdue = isOverdue(t);
                return (
                  <TableRow key={t.id} hover onClick={() => navigate(`/tasks/${t.id}`)} sx={{ cursor: 'pointer' }}>
                    <TableCell>{t.title}</TableCell>
                    <TableCell>{projectMap.get(t.projectId)?.name ?? '—'}</TableCell>
                    <TableCell>{columnCategoryOf(t) && <ColumnCategoryChip category={columnCategoryOf(t)} />}</TableCell>
                    <TableCell>
                      <PriorityChip priority={t.priority} />
                    </TableCell>
                    <TableCell sx={{ color: overdue ? 'error.main' : undefined, fontWeight: overdue ? 700 : 400 }}>
                      {formatDateShort(t.dueDate)}
                    </TableCell>
                    <TableCell>{formatDateShort(t.updatedAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
