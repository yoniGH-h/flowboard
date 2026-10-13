// ניהול הארגונים (מנהל מערכת).

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import DomainOutlinedIcon from '@mui/icons-material/DomainOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import { PageHeader } from '../../components/common/PageHeader';
import { KpiCard } from '../../components/common/KpiCard';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingState } from '../../components/common/States';
import { useAllAuditLog, useOrganizations, useSetOrganizationStatus } from '../../lib/queries';
import { formatDate, formatDateTime } from '../../lib/format';

// כל הארגונים במערכת: השעיה והפעלה.
export function OrganizationsSystemManagementPage() {
  const [tab, setTab] = useState('organizations');
  const { data: organizations, isLoading } = useOrganizations();
  const { data: activity } = useAllAuditLog();
  const setOrgStatus = useSetOrganizationStatus();
  const [confirmTarget, setConfirmTarget] = useState(null);

  const totals = useMemo(() => {
    const orgs = organizations ?? [];
    return {
      organizations: orgs.length,
      activeOrganizations: orgs.filter((o) => o.status === 'ACTIVE').length,
      users: orgs.reduce((sum, o) => sum + o.memberCount, 0),
      projects: orgs.reduce((sum, o) => sum + o.projectCount, 0),
    };
  }, [organizations]);

  if (isLoading) return <LoadingState label="Loading system overview…" />;

  return (
    <Box>
      <PageHeader title="Organizations & System Management" description="Platform-wide oversight across every organization on FlowBoard." />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Organizations"
            value={totals.organizations}
            icon={<DomainOutlinedIcon fontSize="small" />}
            helperText={`${totals.activeOrganizations} active`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Total Users"
            value={totals.users}
            icon={<GroupsOutlinedIcon fontSize="small" />}
            accentColor="#2A6FB0"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Total Projects"
            value={totals.projects}
            icon={<AssessmentOutlinedIcon fontSize="small" />}
            accentColor="#2E7D32"
          />
        </Grid>
      </Grid>

      <Card>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid #E7E7EB' }}>
          <Tab value="organizations" label="Organizations" />
          <Tab value="activity" label="System Activity" />
        </Tabs>
        <CardContent>
          {tab === 'organizations' ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Organization</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell align="right">Users</TableCell>
                    <TableCell align="right">Projects</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(organizations ?? []).map((org) => (
                    <TableRow key={org.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{org.name}</TableCell>
                      <TableCell>
                        <Chip label={org.plan} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{org.memberCount}</TableCell>
                      <TableCell align="right">{org.projectCount}</TableCell>
                      <TableCell>{formatDate(org.createdAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label={org.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                          size="small"
                          color={org.status === 'ACTIVE' ? 'success' : 'warning'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" color={org.status === 'ACTIVE' ? 'warning' : 'success'} onClick={() => setConfirmTarget(org)}>
                          {org.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date & time</TableCell>
                    <TableCell>Organization</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Entity</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(activity ?? []).map((entry) => (
                    <TableRow key={entry.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.createdAt)}</TableCell>
                      <TableCell>{entry.organizationName}</TableCell>
                      <TableCell>{entry.actorName}</TableCell>
                      <TableCell>
                        <Chip label={entry.action.replace(/_/g, ' ')} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{entry.entityType}</TableCell>
                      <TableCell>{entry.metadata}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmTarget}
        title={confirmTarget?.status === 'ACTIVE' ? 'Suspend organization' : 'Activate organization'}
        description={
          confirmTarget?.status === 'ACTIVE'
            ? `"${confirmTarget?.name}" and all its users will immediately lose access to FlowBoard.`
            : `"${confirmTarget?.name}" will regain full access to FlowBoard.`
        }
        confirmLabel={confirmTarget?.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
        danger={confirmTarget?.status === 'ACTIVE'}
        onClose={() => setConfirmTarget(null)}
        onConfirm={async () => {
          if (confirmTarget)
            await setOrgStatus.mutateAsync({ orgId: confirmTarget.id, status: confirmTarget.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' });
          setConfirmTarget(null);
        }}
      />
    </Box>
  );
}
