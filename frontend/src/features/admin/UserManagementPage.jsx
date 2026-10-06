import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
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
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined';
import { PageHeader } from '../../components/common/PageHeader';
import { UserIdentity } from '../../components/common/UserAvatar';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { KpiCard } from '../../components/common/KpiCard';
import { LoadingState, NoSearchResultsState } from '../../components/common/States';
import { ROLE_LABELS, useAuth } from '../../auth/AuthContext';
import { useOrganizationUsers, useRemoveUser, useSetUserStatus, useUpdateUserRoles } from '../../lib/queries';
import { fullName } from '../../lib/format';
import { buildSparkline } from '../../lib/trends';
import { UserPermissionsDialog } from './UserPermissionsDialog';

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', color: 'success' },
  SUSPENDED: { label: 'Suspended', color: 'warning' },
  INVITED: { label: 'Invited', color: 'default' },
};

const ALL_ROLES = ['EMPLOYEE', 'PROJECT_MANAGER', 'ORG_ADMIN', 'SYSTEM_ADMIN'];

export function UserManagementPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Unfiltered fetch for the KPI cards (they summarize the whole org, not the current
  // search/status selection); a separately-filtered, server-side query for the table rows.
  const { data: allUsers } = useOrganizationUsers();
  const { data: filtered = [], isLoading } = useOrganizationUsers({
    search: search.trim() || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  });
  const setStatus = useSetUserStatus();
  const updateRoles = useUpdateUserRoles();
  const removeUser = useRemoveUser();

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [roleDialogUser, setRoleDialogUser] = useState(null);
  const [pendingRoles, setPendingRoles] = useState([]);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [permissionsUser, setPermissionsUser] = useState(null);
  const { user: me } = useAuth();
  // Only with permissions.manage, and only on a backend that supports per-user permissions
  // (it sends `permissions` in /users/me - the Express one).
  const canManagePermissions = !!me?.permissions?.includes('permissions.manage');

  const summary = useMemo(() => {
    const list = allUsers ?? [];
    return {
      total: list.length,
      active: list.filter((u) => u.status === 'ACTIVE').length,
      suspended: list.filter((u) => u.status === 'SUSPENDED').length,
      invited: list.filter((u) => u.status === 'INVITED').length,
    };
  }, [allUsers]);

  if (isLoading) return <LoadingState label="Loading users…" />;

  return (
    <Box>
      <PageHeader title="User Management" description="Activate, suspend, and manage roles for people in your organization." />

      {(allUsers ?? []).length > 0 && (
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Total Users"
              value={summary.total}
              icon={<PeopleAltOutlinedIcon fontSize="small" />}
              sparkline={buildSparkline(summary.total, 6, 1)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Active"
              value={summary.active}
              icon={<CheckCircleOutlineOutlinedIcon fontSize="small" />}
              accentColor="#2E7D32"
              sparkline={buildSparkline(summary.active, 6, 2)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Suspended"
              value={summary.suspended}
              icon={<BlockOutlinedIcon fontSize="small" />}
              accentColor="#8A5A00"
              sparkline={buildSparkline(summary.suspended, 6, 3)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Invited"
              value={summary.invited}
              icon={<MailOutlineOutlinedIcon fontSize="small" />}
              accentColor="#2A6FB0"
              sparkline={buildSparkline(summary.invited, 6, 4)}
            />
          </Grid>
        </Grid>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField
          size="small"
          placeholder="Search by name or email…"
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
          sx={{ minWidth: 260 }}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="ALL">All statuses</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="SUSPENDED">Suspended</MenuItem>
          <MenuItem value="INVITED">Invited</MenuItem>
        </TextField>
      </Stack>

      {filtered.length === 0 ? (
        <NoSearchResultsState
          onClear={() => {
            setSearch('');
            setStatusFilter('ALL');
          }}
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Roles</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <UserIdentity user={u} size="small" subtitle={u.email} />
                  </TableCell>
                  <TableCell>{u.title}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {u.roles.map((r) => (
                        <Chip key={r} label={ROLE_LABELS[r]} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={STATUS_CONFIG[u.status].label} size="small" color={STATUS_CONFIG[u.status].color} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => setMenuAnchor({ el: e.currentTarget, user: u })}
                      aria-label={`Actions for ${fullName(u)}`}
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
            if (menuAnchor) {
              setRoleDialogUser(menuAnchor.user);
              setPendingRoles(menuAnchor.user.roles);
            }
            setMenuAnchor(null);
          }}
        >
          Edit roles
        </MenuItem>
        {canManagePermissions && (
          <MenuItem
            onClick={() => {
              if (menuAnchor) setPermissionsUser(menuAnchor.user);
              setMenuAnchor(null);
            }}
          >
            Permissions
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (menuAnchor)
              setStatus.mutate({ userId: menuAnchor.user.id, status: menuAnchor.user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' });
            setMenuAnchor(null);
          }}
        >
          {menuAnchor?.user.status === 'ACTIVE' ? 'Suspend user' : 'Activate user'}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) setConfirmRemove(menuAnchor.user);
            setMenuAnchor(null);
          }}
          sx={{ color: 'error.main' }}
        >
          Remove from organization
        </MenuItem>
      </Menu>

      <Dialog open={!!roleDialogUser} onClose={() => setRoleDialogUser(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit roles — {roleDialogUser ? fullName(roleDialogUser) : ''}</DialogTitle>
        <DialogContent>
          <FormGroup>
            {ALL_ROLES.map((r) => (
              <FormControlLabel
                key={r}
                control={
                  <Checkbox
                    checked={pendingRoles.includes(r)}
                    onChange={(e) => setPendingRoles((prev) => (e.target.checked ? [...prev, r] : prev.filter((role) => role !== r)))}
                  />
                }
                label={ROLE_LABELS[r]}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRoleDialogUser(null)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={pendingRoles.length === 0 || updateRoles.isPending}
            onClick={async () => {
              if (roleDialogUser) await updateRoles.mutateAsync({ userId: roleDialogUser.id, roles: pendingRoles });
              setRoleDialogUser(null);
            }}
          >
            Save roles
          </Button>
        </DialogActions>
      </Dialog>

      <UserPermissionsDialog user={permissionsUser} onClose={() => setPermissionsUser(null)} />

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove user"
        description={`Remove ${confirmRemove ? fullName(confirmRemove) : ''} from the organization? They will lose access immediately and be unassigned from all tasks.`}
        confirmLabel="Remove"
        danger
        onClose={() => setConfirmRemove(null)}
        onConfirm={async () => {
          if (confirmRemove) await removeUser.mutateAsync(confirmRemove.id);
          setConfirmRemove(null);
        }}
      />
    </Box>
  );
}
