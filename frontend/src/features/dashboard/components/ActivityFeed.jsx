// רשימת הפעילות האחרונה.

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import SyncAltOutlinedIcon from '@mui/icons-material/SyncAltOutlined';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { EmptyState } from '../../../components/common/States';
import { formatRelativeToNow } from '../../../lib/format';

const ICON_BY_KEYWORD = [
  ['ASSIGN', AssignmentIndOutlinedIcon],
  ['STATUS', SyncAltOutlinedIcon],
  ['CREATE', AddCircleOutlineOutlinedIcon],
  ['DELETE', DeleteOutlineOutlinedIcon],
  ['ARCHIVE', ArchiveOutlinedIcon],
  ['SUSPEND', SecurityOutlinedIcon],
  ['ACTIVATE', SecurityOutlinedIcon],
  ['ROLE', SecurityOutlinedIcon],
  ['PERMISSION', SecurityOutlinedIcon],
  ['USER', PersonOutlinedIcon],
  ['SETTINGS', SettingsOutlinedIcon],
  ['SIGNED_IN', LoginOutlinedIcon],
];

function iconFor(action) {
  const match = ICON_BY_KEYWORD.find(([keyword]) => action.includes(keyword));
  return match ? match[1] : HistoryOutlinedIcon;
}

function titleFor(entry) {
  return entry.action
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

// רשימת אירועים עם מבצע, פעולה וזמן.
// נקרא מ: ManagementDashboardPage.jsx
export function ActivityFeed({ entries, userMap }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h4" sx={{ mb: 1.5 }}>
          Recent activity
        </Typography>
        {entries.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <Stack spacing={2}>
            {entries.slice(0, 10).map((entry) => {
              const Icon = iconFor(entry.action);
              const actor = userMap.get(entry.actorId);
              return (
                <Stack key={entry.id} direction="row" spacing={1.25}>
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#F2F3F7',
                      color: 'text.secondary',
                      flexShrink: 0,
                      '& svg': { fontSize: 16 },
                    }}
                  >
                    <Icon fontSize="inherit" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {titleFor(entry)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {actor ? `${actor.firstName} ${actor.lastName}` : 'System'} · {entry.metadata}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {formatRelativeToNow(entry.createdAt, new Date())}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
