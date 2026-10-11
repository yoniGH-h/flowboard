// תפקיד הקובץ: סימולטור "מה אם".
// משתמשים בו: DecisionCenterPage.jsx

import { useEffect, useMemo, useState } from 'react';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import { useSimulation } from '../../lib/queries';
import { ImpactSummary } from './ImpactSummary';
import { ApplyDecisionDialog } from './ApplyDecisionDialog';

// The what-if simulator: pick changes on the left, see their predicted effect on the right.
// Nothing is saved until "Apply" - the server only calculates.
// בחירת שינויים והצגת ההשפעה שלהם, בלי לשמור.
// נקרא מ: DecisionCenterPage.jsx
export function SimulatorPanel({ projectId, view, initialChanges }) {
  const simulation = useSimulation();
  const [reassign, setReassign] = useState(initialChanges?.reassign ?? []);
  const [deferTaskIds, setDeferTaskIds] = useState(initialChanges?.deferTaskIds ?? []);
  const [addMemberIds, setAddMemberIds] = useState(initialChanges?.addMemberIds ?? []);
  const [unblockTaskIds, setUnblockTaskIds] = useState(initialChanges?.unblockTaskIds ?? []);
  const [newTargetDate, setNewTargetDate] = useState('');
  const [applyOpen, setApplyOpen] = useState(false);

  const people = useMemo(() => new Map(view.people.map((p) => [p.userId, p])), [view.people]);
  const tasks = useMemo(() => new Map(view.openTasks.map((t) => [t.id, t])), [view.openTasks]);
  const members = view.people.filter((p) => p.isMember || addMemberIds.includes(p.userId));
  const nonMembers = view.people.filter((p) => !p.isMember);
  const blocked = view.openTasks.filter((t) => t.blocked);

  const taskLabel = (t) => `${t.title} · ${t.columnName}${t.assigneeId ? ` · ${people.get(t.assigneeId)?.name ?? ''}` : ''}`;
  const personLabel = (p) => `${p.name} (${p.openTotal} open)`;

  // The changes in the server's format; incomplete reassign rows are ignored.
  const changes = useMemo(() => {
    const c = {};
    const rows = reassign.filter((r) => r.taskId && r.toUserId);
    if (rows.length) c.reassign = rows;
    if (deferTaskIds.length) c.deferTaskIds = deferTaskIds;
    if (addMemberIds.length) c.addMemberIds = addMemberIds;
    if (unblockTaskIds.length) c.unblockTaskIds = unblockTaskIds;
    if (newTargetDate) c.newTargetDate = new Date(`${newTargetDate}T12:00:00`).toISOString();
    return c;
  }, [reassign, deferTaskIds, addMemberIds, unblockTaskIds, newTargetDate]);
  const hasChanges = Object.keys(changes).length > 0;
  const changesKey = JSON.stringify(changes);

  // Re-simulate shortly after every edit.
  const { mutate } = simulation;
  useEffect(() => {
    if (!hasChanges) return undefined;
    const timer = setTimeout(() => mutate({ projectId, changes: JSON.parse(changesKey) }), 350);
    return () => clearTimeout(timer);
  }, [changesKey, hasChanges, projectId, mutate]);

  const reset = () => {
    setReassign([]);
    setDeferTaskIds([]);
    setAddMemberIds([]);
    setUnblockTaskIds([]);
    setNewTargetDate('');
    simulation.reset();
  };

  const result = hasChanges ? simulation.data : null;

  return (
    <Grid container spacing={3}>
      {/* ---------- The changes ---------- */}
      <Grid size={{ xs: 12, md: 5 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Reassign tasks
            </Typography>
            <Stack spacing={1}>
              {reassign.map((row, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <Autocomplete
                    size="small"
                    sx={{ flex: 3 }}
                    options={view.openTasks}
                    getOptionLabel={taskLabel}
                    value={tasks.get(row.taskId) ?? null}
                    onChange={(_e, t) => setReassign(reassign.map((r, j) => (j === i ? { ...r, taskId: t?.id } : r)))}
                    renderInput={(params) => <TextField {...params} label="Task" />}
                  />
                  <Autocomplete
                    size="small"
                    sx={{ flex: 2 }}
                    options={members}
                    getOptionLabel={personLabel}
                    value={people.get(row.toUserId) ?? null}
                    onChange={(_e, p) => setReassign(reassign.map((r, j) => (j === i ? { ...r, toUserId: p?.userId } : r)))}
                    renderInput={(params) => <TextField {...params} label="To" />}
                  />
                  <IconButton size="small" aria-label="Remove" onClick={() => setReassign(reassign.filter((_r, j) => j !== i))}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Box>
                <Button size="small" startIcon={<AddIcon />} onClick={() => setReassign([...reassign, {}])}>
                  Add a reassignment
                </Button>
              </Box>
            </Stack>
          </Box>

          <Autocomplete
            multiple
            size="small"
            options={view.openTasks}
            getOptionLabel={taskLabel}
            value={deferTaskIds.map((id) => tasks.get(id)).filter(Boolean)}
            onChange={(_e, list) => setDeferTaskIds(list.map((t) => t.id))}
            renderInput={(params) => <TextField {...params} label="Defer tasks (out of this release)" />}
          />

          <Autocomplete
            multiple
            size="small"
            options={nonMembers}
            getOptionLabel={personLabel}
            value={addMemberIds.map((id) => people.get(id)).filter(Boolean)}
            onChange={(_e, list) => setAddMemberIds(list.map((p) => p.userId))}
            renderInput={(params) => <TextField {...params} label="Add people to the project" />}
          />

          <Autocomplete
            multiple
            size="small"
            options={blocked}
            getOptionLabel={taskLabel}
            value={unblockTaskIds.map((id) => tasks.get(id)).filter(Boolean)}
            onChange={(_e, list) => setUnblockTaskIds(list.map((t) => t.id))}
            noOptionsText="No blocked tasks"
            renderInput={(params) => <TextField {...params} label="Resolve blockers" />}
          />

          <TextField
            size="small"
            type="date"
            label="Move the target date"
            value={newTargetDate}
            onChange={(e) => setNewTargetDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={!result || simulation.isPending} onClick={() => setApplyOpen(true)}>
              Apply these changes
            </Button>
            <Button color="inherit" onClick={reset} disabled={!hasChanges}>
              Reset
            </Button>
          </Stack>
        </Stack>
      </Grid>

      {/* ---------- The predicted effect ---------- */}
      <Grid size={{ xs: 12, md: 7 }}>
        {!hasChanges && (
          <Stack alignItems="center" spacing={1} sx={{ py: 6, color: 'text.secondary', textAlign: 'center' }}>
            <ScienceOutlinedIcon sx={{ fontSize: 40 }} />
            <Typography variant="body2">
              Pick a change on the left to see what it would do to the forecast, the delay risk and the team&apos;s workload -
              before you commit to anything.
            </Typography>
          </Stack>
        )}
        {hasChanges && simulation.isError && <Alert severity="warning">{simulation.error.message}</Alert>}
        {hasChanges && !result && simulation.isPending && (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress aria-label="Simulating" />
          </Box>
        )}
        {result && !simulation.isError && (
          <Box sx={{ opacity: simulation.isPending ? 0.5 : 1, transition: 'opacity .2s' }}>
            <ImpactSummary before={result.before} after={result.after} loadChanges={result.loadChanges} />
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              Assumptions
            </Typography>
            {result.assumptions.map((a) => (
              <Typography key={a} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                • {a}
              </Typography>
            ))}
          </Box>
        )}
      </Grid>

      <ApplyDecisionDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onApplied={reset}
        projectId={projectId}
        changes={changes}
        summary={result?.changes.map((c) => c.text)}
        source="SIMULATOR"
      />
    </Grid>
  );
}
