// תפקיד הקובץ: חלון ההרשאות של משתמש אחד.
// משתמשים בו: UserManagementPage.jsx

import { Fragment, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import { ROLE_LABELS } from '../../auth/AuthContext';
import { usePermissionMatrix, useSetUserPermission, useUserPermissions } from '../../lib/queries';
import { SCOPE_LABELS } from '../../lib/permissions';
import { formatDate, fullName } from '../../lib/format';

const SOURCE_LABELS = { role: 'Role', organization: 'Organization setting', user: 'Exception' };

// One employee's permissions: what they may do, WHY (their role, an organization-wide change
// to their role, or a personal exception), and controls to add / remove exceptions.
// מציג מאיפה כל הרשאה מגיעה, ומאפשר חריגים אישיים.
// נקרא מ: UserManagementPage.jsx
export function UserPermissionsDialog({ user, onClose }) {
  return (
    <Dialog open={!!user} onClose={onClose} maxWidth="md" fullWidth>
      {user && <UserPermissionsContent key={user.id} user={user} onClose={onClose} />}
    </Dialog>
  );
}

function UserPermissionsContent({ user, onClose }) {
  const { data, isLoading, error } = useUserPermissions(user.id);
  const { data: matrix } = usePermissionMatrix();
  const setUserPermission = useSetUserPermission();
  // The exception being added: { key, granted } - opens the small "until / reason" form.
  const [pending, setPending] = useState(null);

  // Catalog entries (labels, groups), without platform-level permissions.
  const groups = useMemo(() => {
    const map = new Map();
    for (const p of matrix?.permissions ?? []) {
      if (p.scope === 'system') continue;
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group).push(p);
    }
    return [...map.entries()];
  }, [matrix]);

  if (isLoading || !matrix) {
    return (
      <DialogContent sx={{ display: 'grid', placeItems: 'center', minHeight: 200 }}>
        <CircularProgress aria-label="Loading permissions" />
      </DialogContent>
    );
  }
  if (error) {
    return (
      <>
        <DialogContent>
          <Alert severity="error">{error.message}</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </>
    );
  }

  const effective = new Map(data.permissions.map((p) => [p.key, p]));
  const activeOverride = (key) => data.overrides.find((o) => o.key === key && !o.expired);
  const expiredOverride = (key) => data.overrides.find((o) => o.key === key && o.expired);

  const choose = (key, value) => {
    if (value === null) return; // clicking the already-selected button
    if (value === 'role') {
      setUserPermission.mutate({ userId: user.id, key, granted: null });
    } else {
      setPending({ key, granted: value === 'allow', expiresAt: '', reason: '' });
    }
  };

  const savePending = async () => {
    try {
      await setUserPermission.mutateAsync({
        userId: user.id,
        key: pending.key,
        granted: pending.granted,
        expiresAt: pending.expiresAt ? new Date(`${pending.expiresAt}T23:59:59`).toISOString() : undefined,
        reason: pending.reason,
      });
      setPending(null);
    } catch {
      // The server's explanation is shown inside this form (setUserPermission.error).
    }
  };

  const closePending = () => {
    setPending(null);
    setUserPermission.reset();
  };

  const pendingLabel = pending && matrix.permissions.find((p) => p.key === pending.key)?.label;

  return (
    <>
      <DialogTitle>
        Permissions — {fullName(user)}
        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
          {data.user.roles.map((r) => (
            <Chip key={r} label={ROLE_LABELS[r]} size="small" variant="outlined" />
          ))}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Permissions come from the roles above. An exception changes a single permission for {user.firstName} only -
          &quot;Allow&quot; adds it, &quot;Deny&quot; takes it away - optionally until a date.
        </Typography>
        {!data.editable && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            {data.notEditableReason}
          </Alert>
        )}
        {setUserPermission.isError && !pending && (
          <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setUserPermission.reset()}>
            {setUserPermission.error.message}
          </Alert>
        )}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Permission</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Comes from</TableCell>
              <TableCell align="right">Exception</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map(([group, permissions]) => (
              <Fragment key={group}>
                <TableRow>
                  <TableCell colSpan={4} sx={{ bgcolor: 'action.hover', fontWeight: 700, py: 0.75 }}>
                    {group}
                  </TableCell>
                </TableRow>
                {permissions.map((perm) => {
                  const e = effective.get(perm.key);
                  const override = activeOverride(perm.key);
                  const expired = expiredOverride(perm.key);
                  const value = override ? (override.granted ? 'allow' : 'deny') : 'role';
                  return (
                    <TableRow key={perm.key} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {perm.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {SCOPE_LABELS[perm.scope]}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={e.granted ? 'Allowed' : 'Not allowed'}
                          size="small"
                          color={e.granted ? 'success' : 'default'}
                          variant={e.granted ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip
                          title={
                            override
                              ? `${override.reason ? `"${override.reason}" - ` : ''}by ${override.grantedBy.firstName} ${override.grantedBy.lastName}. Without it: ${e.roleGranted ? 'allowed' : 'not allowed'}.`
                              : ''
                          }
                        >
                          <span>
                            <Typography variant="body2" component="span" color={e.source === 'user' ? 'warning.dark' : 'text.primary'}>
                              {SOURCE_LABELS[e.source]}
                            </Typography>
                            {override?.expiresAt && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                until {formatDate(override.expiresAt)}
                              </Typography>
                            )}
                            {!override && expired && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                exception expired {formatDate(expired.expiresAt)}
                              </Typography>
                            )}
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          value={value}
                          disabled={!data.editable || setUserPermission.isPending}
                          onChange={(_e, v) => choose(perm.key, v)}
                          aria-label={`Exception for ${perm.label}`}
                        >
                          <ToggleButton value="role">Role</ToggleButton>
                          <ToggleButton value="allow" color="success">
                            Allow
                          </ToggleButton>
                          <ToggleButton value="deny" color="error">
                            Deny
                          </ToggleButton>
                        </ToggleButtonGroup>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {/* The exception details: optional end date and reason */}
      <Dialog open={!!pending} onClose={closePending} maxWidth="xs" fullWidth>
        {pending && (
          <>
            <DialogTitle>
              {pending.granted ? 'Allow' : 'Deny'} &quot;{pendingLabel}&quot; for {user.firstName}
            </DialogTitle>
            <DialogContent>
              {setUserPermission.isError && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {setUserPermission.error.message}
                </Alert>
              )}
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label="Until (optional)"
                  type="date"
                  value={pending.expiresAt}
                  onChange={(e) => setPending({ ...pending, expiresAt: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: new Date().toISOString().slice(0, 10) } }}
                  helperText="Leave empty for a permanent exception."
                  fullWidth
                />
                <TextField
                  label="Reason (optional)"
                  value={pending.reason}
                  onChange={(e) => setPending({ ...pending, reason: e.target.value })}
                  inputProps={{ maxLength: 200 }}
                  helperText="Shown in the audit log and to other admins."
                  fullWidth
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={closePending} color="inherit">
                Cancel
              </Button>
              <Button variant="contained" color={pending.granted ? 'success' : 'error'} onClick={savePending} disabled={setUserPermission.isPending}>
                {pending.granted ? 'Allow' : 'Deny'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
