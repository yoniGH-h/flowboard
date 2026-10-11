// תפקיד הקובץ: חלון הגדרות הלוח.
// משתמשים בו: KanbanBoardPage.jsx

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { useAddBoardColumn, useDeleteBoardColumn, useUpdateBoardColumn } from '../../lib/queries';

// Board settings (the project's manager): add, rename, reorder and delete columns, and set
// each column's WIP limit. Every change is saved right away; the server checks the
// board.configure permission and refuses to delete a column that still has tasks.

const CATEGORIES = [
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'DONE', label: 'Done' },
];

// '' = no limit; otherwise a whole number of at least 1.
const parseWip = (text) => (text.trim() === '' ? null : Number(text));
const isValidWip = (text) => text.trim() === '' || (Number.isInteger(Number(text)) && Number(text) >= 1);

function ColumnRow({ column, index, count, taskCount, onRename, onWip, onMove, onDelete, busy }) {
  const [name, setName] = useState(column.name);
  const [wip, setWip] = useState(column.wipLimit ? String(column.wipLimit) : '');
  const category = CATEGORIES.find((c) => c.value === column.category)?.label ?? column.category;

  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" data-testid="board-settings-column">
      <TextField
        label="Column name"
        size="small"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== column.name && onRename(name.trim())}
        sx={{ flex: 1, minWidth: 170 }}
      />
      <TextField label="Stage" size="small" value={category} disabled sx={{ width: 120 }} />
      <TextField
        label="WIP limit"
        size="small"
        value={wip}
        placeholder="None"
        onChange={(e) => setWip(e.target.value)}
        onBlur={() => isValidWip(wip) && parseWip(wip) !== (column.wipLimit ?? null) && onWip(parseWip(wip))}
        error={!isValidWip(wip)}
        sx={{ width: 100 }}
        slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `WIP limit for ${column.name}` } }}
      />
      <Tooltip title="Move up">
        <span>
          <IconButton aria-label={`Move ${column.name} up`} disabled={busy || index === 0} onClick={() => onMove(-1)}>
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Move down">
        <span>
          <IconButton aria-label={`Move ${column.name} down`} disabled={busy || index === count - 1} onClick={() => onMove(1)}>
            <ArrowDownwardIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={taskCount > 0 ? `Has ${taskCount} task(s) - move them first` : 'Delete column'}>
        <span>
          <IconButton aria-label={`Delete ${column.name}`} color="error" disabled={busy} onClick={onDelete}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

// ניהול עמודות: הוספה, שינוי שם, סדר, מגבלת WIP ומחיקה.
// נקרא מ: KanbanBoardPage.jsx
export function BoardSettingsDialog({ open, onClose, projectId, columns, tasks }) {
  const addColumn = useAddBoardColumn();
  const updateColumn = useUpdateBoardColumn();
  const deleteColumn = useDeleteBoardColumn();
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('IN_PROGRESS');
  const [newWip, setNewWip] = useState('');

  const busy = addColumn.isPending || updateColumn.isPending || deleteColumn.isPending;
  const sorted = [...(columns ?? [])].sort((a, b) => a.order - b.order);
  const tasksIn = (columnId) => (tasks ?? []).filter((t) => t.columnId === columnId && !t.archived).length;

  // Shows the server's message (e.g. "Move or archive the tasks in this column...") on failure.
  const run = async (action) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  // Moving a column swaps its order with the neighbour's.
  const move = (index, direction) =>
    run(async () => {
      const a = sorted[index];
      const b = sorted[index + direction];
      await updateColumn.mutateAsync({ projectId, columnId: a.id, patch: { order: b.order } });
      await updateColumn.mutateAsync({ projectId, columnId: b.id, patch: { order: a.order } });
    });

  const add = () =>
    run(async () => {
      await addColumn.mutateAsync({
        projectId,
        column: { name: newName.trim(), category: newCategory, ...(newWip.trim() ? { wipLimit: Number(newWip) } : {}) },
      });
      setNewName('');
      setNewWip('');
    });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="board-settings-title">
      <DialogTitle id="board-settings-title">Board settings</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Changes are saved right away. A WIP limit is the most tasks a column may hold at once - leave it empty for no limit.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stack spacing={1.5} divider={<Divider flexItem />} sx={{ pt: 1 }}>
          {sorted.map((column, index) => (
            <ColumnRow
              key={`${column.id}-${column.name}-${column.wipLimit}`}
              column={column}
              index={index}
              count={sorted.length}
              taskCount={tasksIn(column.id)}
              busy={busy}
              onRename={(name) => run(() => updateColumn.mutateAsync({ projectId, columnId: column.id, patch: { name } }))}
              onWip={(wipLimit) => run(() => updateColumn.mutateAsync({ projectId, columnId: column.id, patch: { wipLimit } }))}
              onMove={(direction) => move(index, direction)}
              onDelete={() => run(() => deleteColumn.mutateAsync({ projectId, columnId: column.id }))}
            />
          ))}
        </Stack>

        <Divider sx={{ my: 2.5 }} />
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Add a column
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField label="New column name" size="small" value={newName} onChange={(e) => setNewName(e.target.value)} sx={{ flex: 1, minWidth: 180 }} />
          <TextField select label="Stage" size="small" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} sx={{ width: 140 }}>
            {CATEGORIES.map((c) => (
              <MenuItem key={c.value} value={c.value}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="WIP limit"
            size="small"
            value={newWip}
            placeholder="None"
            onChange={(e) => setNewWip(e.target.value)}
            error={!isValidWip(newWip)}
            sx={{ width: 100 }}
          />
          <Button variant="outlined" startIcon={<AddIcon />} disabled={busy || !newName.trim() || !isValidWip(newWip)} onClick={add}>
            Add column
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
