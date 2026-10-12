// מסך יומן הביקורת.

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import SearchIcon from '@mui/icons-material/Search';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState, NoSearchResultsState } from '../../components/common/States';
import { useAuditLog, useOrganizationUsers } from '../../lib/queries';
import { formatDateTime, fullName } from '../../lib/format';

// טבלת הפעולות שנרשמו, עם סינון.
// נקרא מ: App.jsx
export function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [actorFilter, setActorFilter] = useState('ALL');

  // האפשרויות ברשימה "Action" מגיעות משליפה לא מסוננת (הסינון בשרת
  // מצמצם את השורות, לא את מה שמוצע לסינון), ואילו הטבלה עצמה משתמשת
  // בשאילתה המסוננת שלמטה.
  const { data: allAuditLog } = useAuditLog({});
  const { data: auditLog, isLoading } = useAuditLog({
    action: actionFilter === 'ALL' ? undefined : actionFilter,
    actorId: actorFilter === 'ALL' ? undefined : actorFilter,
    search: search.trim() || undefined,
  });
  const { data: users } = useOrganizationUsers();

  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);
  const actions = useMemo(() => Array.from(new Set((allAuditLog ?? []).map((a) => a.action))).sort(), [allAuditLog]);

  const filtered = auditLog ?? [];

  if (isLoading) return <LoadingState label="Loading audit log…" />;

  return (
    <Box>
      <PageHeader title="Audit Log" description="A chronological record of important actions taken across your organization." />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField
          size="small"
          placeholder="Search audit log…"
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
          sx={{ minWidth: 240 }}
        />
        <TextField
          select
          size="small"
          label="Action"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="ALL">All actions</MenuItem>
          {actions.map((a) => (
            <MenuItem key={a} value={a}>
              {a.replace(/_/g, ' ')}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Actor"
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="ALL">All users</MenuItem>
          {(users ?? []).map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {fullName(u)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {filtered.length === 0 ? (
        <NoSearchResultsState
          onClear={() => {
            setSearch('');
            setActionFilter('ALL');
            setActorFilter('ALL');
          }}
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date & time</TableCell>
                <TableCell>Actor</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((entry) => {
                const actor = userMap.get(entry.actorId);
                return (
                  <TableRow key={entry.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.createdAt)}</TableCell>
                    <TableCell>{actor ? fullName(actor) : 'System'}</TableCell>
                    <TableCell>
                      <Chip label={entry.action.replace(/_/g, ' ')} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{entry.entityType}</TableCell>
                    <TableCell>{entry.metadata}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
