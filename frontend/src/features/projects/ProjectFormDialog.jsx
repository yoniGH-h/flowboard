// טופס פרויקט.

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';

import { fullName } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
import { useCreateProject, useUpdateProject } from '../../lib/queries';
import { isOrgAdmin } from '../../lib/permissions';

// חלון יצירה או עריכה של פרויקט.
// נקרא מ: ProjectManagementPage.jsx
// קורא ל: ProjectFormFields
export function ProjectFormDialog({ open, onClose, managers, project }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      {/* MUI Dialog unmounts its children on close by default, so keying on the
          project gives this form fresh state (no stale values) every time it opens. */}
      {open && <ProjectFormFields key={project?.id ?? 'new'} onClose={onClose} managers={managers} project={project} />}
    </Dialog>
  );
}

// שדות הטופס של הפרויקט והשמירה.
// נקרא מ: ProjectFormDialog
// קורא ל: useAuth, useCreateProject, useUpdateProject, isOrgAdmin, fullName
function ProjectFormFields({ onClose, managers, project }) {
  const { organization, user, activeRole } = useAuth();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const isEdit = !!project;

  // רק מנהל ארגון בוחר מי מנהל פרויקט. מנהל פרויקט יוצר פרויקטים
  // לעצמו ולא יכול להעביר פרויקט למישהו אחר (השרת אוכף את אותו כלל).
  const canChooseManager = isOrgAdmin(activeRole);
  const managerOptions = canChooseManager ? managers : managers.filter((m) => m.id === (project?.managerId ?? user?.id));

  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [managerId, setManagerId] = useState(
    project?.managerId ?? (canChooseManager ? managers[0]?.id : user?.id) ?? '',
  );
  const [startDate, setStartDate] = useState(project?.startDate ? project.startDate.slice(0, 10) : '');
  const [targetDate, setTargetDate] = useState(project?.targetDate ? project.targetDate.slice(0, 10) : '');
  const [errors, setErrors] = useState({});

  const handleSubmit = async () => {
    const next = {};
    if (!name.trim()) next.name = 'Project name is required.';
    if (!managerId) next.managerId = 'A project manager is required.';
    if (!startDate) next.startDate = 'Start date is required.';
    if (!targetDate) next.targetDate = 'Target date is required.';
    if (startDate && targetDate && new Date(targetDate) < new Date(startDate))
      next.targetDate = 'Target date must be after the start date.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    if (isEdit && project) {
      await updateProject.mutateAsync({
        projectId: project.id,
        patch: {
          name: name.trim(),
          description: description.trim(),
          managerId,
          startDate: new Date(startDate).toISOString(),
          targetDate: new Date(targetDate).toISOString(),
        },
      });
    } else {
      await createProject.mutateAsync({
        organizationId: organization.id,
        name: name.trim(),
        description: description.trim(),
        managerId,
        startDate: new Date(startDate).toISOString(),
        targetDate: new Date(targetDate).toISOString(),
      });
    }
    onClose();
  };

  const pending = createProject.isPending || updateProject.isPending;

  return (
    <>
      <DialogTitle>{isEdit ? 'Edit project' : 'Create project'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            fullWidth
            required
            autoFocus
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
          <TextField
            select
            label="Project manager"
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            error={!!errors.managerId}
            helperText={errors.managerId ?? (canChooseManager ? undefined : 'Only an organization admin can assign a different manager.')}
            disabled={!canChooseManager}
            fullWidth
            required
          >
            {managerOptions.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {fullName(m)}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              error={!!errors.startDate}
              helperText={errors.startDate}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
              required
            />
            <TextField
              label="Target date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              error={!!errors.targetDate}
              helperText={errors.targetDate}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
              required
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
        </Button>
      </DialogActions>
    </>
  );
}
