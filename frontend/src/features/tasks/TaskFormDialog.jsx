// טופס משימה חדשה.

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';

import { fullName } from '../../lib/format';
import { useCreateTask } from '../../lib/queries';
import { useAuth } from '../../auth/AuthContext';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// חלון יצירת משימה.
// נקרא מ: KanbanBoardPage.jsx, TaskDetailsPage.jsx
// קורא ל: useAuth, useCreateTask, fullName
export function TaskFormDialog({ open, onClose, projectId, columns, defaultColumnId, members, labels, parentTaskId = null, titlePrefix = 'Create task' }) {
  const { user } = useAuth();
  const createTask = useCreateTask();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState(defaultColumnId);
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [titleError, setTitleError] = useState(null);

  const reset = () => {
    setTitle('');
    setDescription('');
    setColumnId(defaultColumnId);
    setAssigneeId('');
    setPriority('MEDIUM');
    setDueDate('');
    setEstimatedHours('');
    setSelectedLabels([]);
    setTitleError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setTitleError('Task title is required.');
      return;
    }
    await createTask.mutateAsync({
      projectId,
      columnId,
      title: title.trim(),
      description: description.trim(),
      assigneeId: assigneeId || null,
      creatorId: user.id,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      estimatedHours: estimatedHours ? Number(estimatedHours) : null,
      labelIds: selectedLabels,
      parentTaskId,
    });
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{titlePrefix}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(null);
            }}
            error={!!titleError}
            helperText={titleError}
            autoFocus
            fullWidth
            required
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField select label="Column" value={columnId} onChange={(e) => setColumnId(e.target.value)} fullWidth>
              {columns.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} fullWidth>
              {PRIORITIES.map((p) => (
                <MenuItem key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField select label="Assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} fullWidth>
              <MenuItem value="">Unassigned</MenuItem>
              {members.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {fullName(m)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>
          <TextField
            label="Estimated effort (hours)"
            type="number"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            slotProps={{ htmlInput: { min: 0 } }}
            fullWidth
          />
          <Box>
            <Chip label="Labels" size="small" variant="outlined" sx={{ mb: 1 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {labels.map((l) => {
                const active = selectedLabels.includes(l.id);
                return (
                  <Chip
                    key={l.id}
                    label={l.name}
                    size="small"
                    onClick={() => setSelectedLabels((prev) => (active ? prev.filter((id) => id !== l.id) : [...prev, l.id]))}
                    sx={{
                      backgroundColor: active ? l.color : `${l.color}22`,
                      color: active ? '#fff' : l.color,
                      fontWeight: 700,
                    }}
                  />
                );
              })}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={createTask.isPending}>
          {createTask.isPending ? 'Creating…' : 'Create task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
