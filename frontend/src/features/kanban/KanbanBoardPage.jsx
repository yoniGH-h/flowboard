// תפקיד הקובץ: מסך לוח ה-Kanban.
// משתמשים בו: App.jsx

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { PageHeader } from '../../components/common/PageHeader';
import { KpiCard } from '../../components/common/KpiCard';
import { LoadingState, EmptyState } from '../../components/common/States';
import { KanbanColumn } from './KanbanColumn';
import { resolveTaskMove } from './resolveTaskMove';
import { TaskFormDialog } from '../tasks/TaskFormDialog';
import { BoardSettingsDialog } from './BoardSettingsDialog';
import { useAuth } from '../../auth/AuthContext';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useBoard, useLabels, useMoveTask, useOrganizationUsers, useProject, useTasks } from '../../lib/queries';
import { projectAbility } from '../../lib/permissions';
import { isOverdue } from '../../lib/taskStatus';

// הלוח: עמודות, כרטיסים, סינון וגרירה בין עמודות.
// נקרא מ: App.jsx
export function KanbanBoardPage() {
  const { projectId } = useParams();
  const { user, activeRole } = useAuth();
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: board, isLoading: boardLoading } = useBoard(projectId);
  const { data: tasks, isLoading: tasksLoading } = useTasks({ projectId });
  const { data: users } = useOrganizationUsers();
  const { data: labels = [] } = useLabels();
  const moveTask = useMoveTask();

  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [moveError, setMoveError] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);
  const labelMap = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const members = useMemo(() => (project ? project.memberIds.map((id) => userMap.get(id)).filter((u) => !!u) : []), [project, userMap]);

  const filteredTasks = useMemo(() => {
    let list = tasks ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (assigneeFilter !== 'ALL') list = list.filter((t) => t.assigneeId === assigneeFilter);
    if (priorityFilter !== 'ALL') list = list.filter((t) => t.priority === priorityFilter);
    if (myTasksOnly && user) list = list.filter((t) => t.assigneeId === user.id);
    return list;
  }, [tasks, search, assigneeFilter, priorityFilter, myTasksOnly, user]);

  // What the signed-in user may do on this board - decided by the server per project.
  const canManageTasks = projectAbility(activeRole, project, 'manageTasks');
  const canConfigureBoard = projectAbility(activeRole, project, 'configureBoard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canCreateTasks = projectAbility(activeRole, project, 'createTasks');
  const canMoveOwnTasks = projectAbility(activeRole, project, 'moveOwnTasks');
  const canDragTask = (task) => canManageTasks || (task.assigneeId === user?.id && canMoveOwnTasks);

  const summary = useMemo(() => {
    const list = tasks ?? [];
    return {
      total: list.length,
      open: list.filter((t) => !t.completedAt).length,
      overdue: list.filter(isOverdue).length,
      blocked: list.filter((t) => t.blocked).length,
    };
  }, [tasks]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    const move = resolveTaskMove(tasks ?? [], String(active.id), over ? String(over.id) : null);
    if (move) {
      moveTask.mutate(move, {
        onError: (err) => setMoveError(err instanceof Error ? err.message : 'Unable to move this task.'),
      });
    }
  };

  if (projectLoading || boardLoading || tasksLoading) return <LoadingState label="Loading board…" />;
  if (!project || !board) return <EmptyState title="Board not found" />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 130px)' }}>
      <Breadcrumbs
        items={[{ label: 'My Projects', to: '/projects' }, { label: project.name, to: `/projects/${project.id}` }, { label: 'Board' }]}
      />
      <PageHeader
        title={`${project.name} — Board`}
        actions={
          <Stack direction="row" spacing={1}>
            {canConfigureBoard && (
              <Button variant="outlined" startIcon={<TuneIcon />} onClick={() => setSettingsOpen(true)}>
                Board settings
              </Button>
            )}
            {canCreateTasks && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
                Add Task
              </Button>
            )}
          </Stack>
        }
      />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Total Tasks"
            value={summary.total}
            icon={<ChecklistOutlinedIcon fontSize="small" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Open"
            value={summary.open}
            icon={<TaskAltOutlinedIcon fontSize="small" />}
            accentColor="#2A6FB0"
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

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          placeholder="Search tasks…"
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
          label="Assignee"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="ALL">All assignees</MenuItem>
          {members.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.firstName} {m.lastName}
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
        <FormControlLabel
          control={<Switch checked={myTasksOnly} onChange={(e) => setMyTasksOnly(e.target.checked)} size="small" />}
          label="My tasks only"
        />
        {(search || assigneeFilter !== 'ALL' || priorityFilter !== 'ALL' || myTasksOnly) && (
          <Chip
            label="Clear filters"
            size="small"
            onClick={() => {
              setSearch('');
              setAssigneeFilter('ALL');
              setPriorityFilter('ALL');
              setMyTasksOnly(false);
            }}
          />
        )}
      </Stack>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', flex: 1, pb: 2 }}>
          {board.columns
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={filteredTasks.filter((t) => t.columnId === col.id)}
                userMap={userMap}
                labelMap={labelMap}
                canDragTask={canDragTask}
              />
            ))}
        </Box>
      </DndContext>

      {canConfigureBoard && (
        <BoardSettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          projectId={project.id}
          columns={board.columns}
          tasks={tasks}
        />
      )}
      {canCreateTasks && (
        <TaskFormDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          projectId={project.id}
          columns={board.columns}
          defaultColumnId={board.columns[0]?.id ?? ''}
          // Without tasks.manage you may only assign new tasks to yourself.
          members={canManageTasks ? members : members.filter((m) => m.id === user?.id)}
          labels={labels}
        />
      )}

      <Snackbar open={!!moveError} autoHideDuration={5000} onClose={() => setMoveError(null)}>
        <Alert severity="error" onClose={() => setMoveError(null)} variant="filled">
          {moveError}
        </Alert>
      </Snackbar>
    </Box>
  );
}
