// מסך התפקידים וההרשאות.

import { Fragment, useMemo } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import CardContent from '@mui/material/CardContent';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Checkbox from '@mui/material/Checkbox';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RemoveIcon from '@mui/icons-material/Remove';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { PageHeader } from '../../components/common/PageHeader';
import { ErrorState, LoadingState } from '../../components/common/States';
import { usePermissionMatrix, useSetRolePermission } from '../../lib/queries';
import { ROLE_LEVEL, SCOPE_LABELS } from '../../lib/permissions';

// טבלת הרשאות לפי תפקיד, עם אפשרות לשנות.
// נקרא מ: App.jsx
export function RolesPermissionsPage() {
  const { data: matrix, isLoading, isError, refetch } = usePermissionMatrix();

  if (isLoading) return <LoadingState label="Loading permissions…" />;
  if (isError || !matrix) return <ErrorState description="Could not load the permission matrix." onRetry={refetch} />;
  return <EditablePermissionMatrix matrix={matrix} />;
}

// ---------- הטבלה הניתנת לעריכה ----------

function EditablePermissionMatrix({ matrix }) {
  const setRolePermission = useSetRolePermission();

  // השורות מקובצות לפי תחום: משימות, פרויקטים, שיתוף פעולה...
  const groups = useMemo(() => {
    const map = new Map();
    for (const p of matrix.permissions) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group).push(p);
    }
    return [...map.entries()];
  }, [matrix.permissions]);

  const cell = (role, key) => role.permissions.find((p) => p.key === key);

  return (
    <Box>
      <PageHeader
        title="Roles & Permissions"
        description="Every role starts from FlowBoard's defaults. Change what a role may do in your organization here; give a single employee an exception from User Management → Permissions."
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {matrix.roles.map((role) => {
          const granted = role.permissions.filter((p) => p.granted).length;
          const changed = role.permissions.filter((p) => p.source === 'organization').length;
          return (
            <Grid key={role.name} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h5" sx={{ mb: 1 }}>
                    {role.label}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={`Level ${ROLE_LEVEL[role.name]}`} size="small" variant="outlined" />
                    <Chip label={`${granted} permissions`} size="small" variant="outlined" />
                    {changed > 0 && <Chip label={`${changed} changed`} size="small" color="warning" variant="outlined" />}
                    {!role.editable && <Chip label="Fixed" size="small" icon={<LockOutlinedIcon />} variant="outlined" />}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {setRolePermission.isError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRolePermission.reset()}>
          {setRolePermission.error.message}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h4" sx={{ mb: 1.5 }}>
            Permission matrix
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Permission</TableCell>
                  <TableCell>Applies to</TableCell>
                  {matrix.roles.map((r) => (
                    <TableCell key={r.name} align="center">
                      {r.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {groups.map(([group, permissions]) => (
                  <Fragment key={group}>
                    <TableRow>
                      <TableCell colSpan={2 + matrix.roles.length} sx={{ bgcolor: 'action.hover', fontWeight: 700, py: 0.75 }}>
                        {group}
                      </TableCell>
                    </TableRow>
                    {permissions.map((perm) => (
                      <TableRow key={perm.key} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {perm.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {perm.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={SCOPE_LABELS[perm.scope]} size="small" variant="outlined" />
                        </TableCell>
                        {matrix.roles.map((role) => {
                          const c = cell(role, perm.key);
                          const locked = perm.lockedFor.includes(role.name) && c.granted;
                          const editable = role.editable && perm.changeable && !locked;
                          const changed = c.source === 'organization';
                          const tooltip = locked
                            ? 'Always on for this role - removing it would lock administrators out'
                            : !editable
                              ? 'Fixed by the platform'
                              : changed
                                ? `Changed for your organization (default: ${c.isDefault ? 'allowed' : 'not allowed'}). Click to change back.`
                                : `Default (${c.granted ? 'allowed' : 'not allowed'}). Click to change for your organization.`;
                          return (
                            <TableCell key={role.name} align="center" sx={changed ? { bgcolor: '#FFF6E0' } : undefined}>
                              <Tooltip title={tooltip}>
                                <span>
                                  {editable ? (
                                    <Checkbox
                                      size="small"
                                      checked={c.granted}
                                      disabled={setRolePermission.isPending}
                                      onChange={(e) =>
                                        setRolePermission.mutate({ roleName: role.name, key: perm.key, granted: e.target.checked })
                                      }
                                      inputProps={{ 'aria-label': `${perm.label} for ${role.label}` }}
                                    />
                                  ) : c.granted ? (
                                    locked ? (
                                      <LockOutlinedIcon fontSize="small" color="success" />
                                    ) : (
                                      <CheckCircleIcon fontSize="small" color="success" />
                                    )
                                  ) : (
                                    <RemoveIcon fontSize="small" sx={{ color: '#D8DCE8' }} />
                                  )}
                                </span>
                              </Tooltip>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack spacing={0.5} sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Highlighted cells are changed from FlowBoard&apos;s default for your organization. Changes take effect immediately.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              &quot;Projects they manage&quot; permissions only work in projects the person manages - a Project Manager can never
              control someone else&apos;s project, whatever is ticked here.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
