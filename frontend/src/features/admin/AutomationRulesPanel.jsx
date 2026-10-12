// ניהול חוקי האוטומציה.
// חלקים עיקריים: רשימת החוקים, טופס חוק חדש, היסטוריית ההרצות.

import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { EmptyState } from '../../components/common/States';
import { useAuth } from '../../auth/AuthContext';
import { useAutomationExecutions, useAutomationRules, useCreateAutomationRule, useDeleteAutomationRule, useOrganizationUsers, useProjects, useToggleAutomationRule, useUpdateAutomationRule } from '../../lib/queries';
import { formatDateTime } from '../../lib/format';

const TRIGGERS = [
  { type: 'TASK_OVERDUE', label: 'When a task becomes overdue' },
  { type: 'ALL_SUBTASKS_COMPLETED', label: 'When all subtasks are completed' },
  { type: 'STATUS_ENTERED', label: 'When a task enters a specific status' },
  { type: 'DUE_DATE_APPROACHING', label: 'When a due date is approaching' },
];

const ACTIONS = [
  { type: 'NOTIFY_ASSIGNEE_AND_MANAGER', label: 'Notify the assignee and project manager' },
  { type: 'MOVE_TO_COLUMN', label: 'Move the task to "In Review"' },
  { type: 'ASSIGN_TO_USER', label: 'Assign the task to a selected user' },
  { type: 'CREATE_NOTIFICATION', label: 'Create a reminder notification' },
];

// רשימת החוקים: יצירה, הפעלה, מחיקה והיסטוריה.
// נקרא מ: OrganizationSettingsPage.jsx
// קורא ל: useAuth, useAutomationRules, useProjects, useOrganizationUsers, useToggleAutomationRule, useCreateAutomationRule +5
export function AutomationRulesPanel() {
  const { organization } = useAuth();
  const { data: rules = [] } = useAutomationRules();
  const { data: projects = [] } = useProjects({});
  const { data: users = [] } = useOrganizationUsers({ status: 'ACTIVE' });
  const toggleRule = useToggleAutomationRule();
  const createRule = useCreateAutomationRule();
  const updateRule = useUpdateAutomationRule();
  const deleteRule = useDeleteAutomationRule();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('ALL');
  const [triggerType, setTriggerType] = useState(TRIGGERS[0].type);
  const [actionType, setActionType] = useState(ACTIONS[0].type);
  const [targetUserId, setTargetUserId] = useState('');
  const [nameError, setNameError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [historyRule, setHistoryRule] = useState(null);
  const { data: executions = [] } = useAutomationExecutions(historyRule?.id);

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  const reset = () => {
    setName('');
    setProjectId('ALL');
    setTriggerType(TRIGGERS[0].type);
    setActionType(ACTIONS[0].type);
    setTargetUserId('');
    setNameError(null);
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setNameError('Give this rule a name.');
      return;
    }
    const trigger = TRIGGERS.find((t) => t.type === triggerType);
    const action = ACTIONS.find((a) => a.type === actionType);
    const ruleInput = {
      organizationId: organization.id,
      projectId: projectId === 'ALL' ? null : projectId,
      name: name.trim(),
      enabled: true,
      trigger,
      action: actionType === 'ASSIGN_TO_USER' ? { ...action, userId: targetUserId } : action,
    };
    if (editingId) await updateRule.mutateAsync({ ruleId: editingId, rule: ruleInput });
    else await createRule.mutateAsync(ruleInput);
    reset();
    setOpen(false);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h4">Automation rules</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          New rule
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Simple, explainable condition-and-action rules. No visual workflow builder — just a trigger and an action.
      </Typography>

      {rules.length === 0 ? (
        <EmptyState
          icon={<BoltOutlinedIcon sx={{ fontSize: 40 }} />}
          title="No automation rules yet"
          description="Create a rule to automate routine project actions."
        />
      ) : (
        <Stack spacing={1.5}>
          {rules.map((rule) => (
            <Box key={rule.id} sx={{ p: 1.75, border: '1px solid #E7E7EB', borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {rule.name}
                    </Typography>
                    <Chip
                      label={rule.projectId ? (projectMap.get(rule.projectId) ?? 'Project') : 'All projects'}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                    <Typography variant="caption">{rule.trigger.label}</Typography>
                    <ArrowForwardIcon sx={{ fontSize: 14 }} />
                    <Typography variant="caption">{rule.action.label}</Typography>
                  </Stack>
                </Box>
                <Stack direction="row" alignItems="center">
                  <Button aria-label={`Edit ${rule.name}`} onClick={() => { setEditingId(rule.id); setName(rule.name); setProjectId(rule.projectId ?? 'ALL'); setTriggerType(rule.trigger.type); setActionType(rule.action.type); setTargetUserId(rule.action.userId ?? ''); setOpen(true); }}><EditOutlinedIcon fontSize="small" /></Button>
                  <Button size="small" onClick={() => setHistoryRule(rule)}>History</Button>
                  <Button color="error" aria-label={`Delete ${rule.name}`} onClick={() => deleteRule.mutate(rule.id)}><DeleteOutlineIcon fontSize="small" /></Button>
                  <Switch checked={rule.enabled} onChange={(e) => toggleRule.mutate({ ruleId: rule.id, enabled: e.target.checked })} />
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit automation rule' : 'New automation rule'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Rule name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              error={!!nameError}
              helperText={nameError}
              fullWidth
              autoFocus
            />
            <TextField select label="Applies to" value={projectId} onChange={(e) => setProjectId(e.target.value)} fullWidth>
              <MenuItem value="ALL">All projects</MenuItem>
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Trigger" value={triggerType} onChange={(e) => setTriggerType(e.target.value)} fullWidth>
              {TRIGGERS.map((t) => (
                <MenuItem key={t.type} value={t.type}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Action" value={actionType} onChange={(e) => setActionType(e.target.value)} fullWidth>
              {ACTIONS.map((a) => (
                <MenuItem key={a.type} value={a.type}>
                  {a.label}
                </MenuItem>
              ))}
            </TextField>
            {actionType === 'ASSIGN_TO_USER' && (
              <TextField select required label="Assign to" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} fullWidth>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>{user.firstName} {user.lastName}</MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={createRule.isPending || updateRule.isPending || (actionType === 'ASSIGN_TO_USER' && !targetUserId)}>
            {editingId ? 'Save changes' : 'Create rule'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!historyRule} onClose={() => setHistoryRule(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Execution history — {historyRule?.name}</DialogTitle>
        <DialogContent>
          {executions.length === 0 ? <Typography color="text.secondary">This rule has not run yet.</Typography> : (
            <Stack spacing={1}>{executions.map((entry) => (
              <Box key={entry.id} sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Chip size="small" color={entry.status === 'SUCCESS' ? 'success' : 'error'} label={entry.status} />
                <Typography variant="caption" sx={{ ml: 1 }}>{formatDateTime(entry.createdAt)}</Typography>
                {entry.message && <Typography variant="body2" color="error.main">{entry.message}</Typography>}
              </Box>
            ))}</Stack>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setHistoryRule(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
