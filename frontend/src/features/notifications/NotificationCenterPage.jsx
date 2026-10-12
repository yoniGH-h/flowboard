// מסך מרכז ההתראות.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import SyncAltOutlinedIcon from '@mui/icons-material/SyncAltOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState, LoadingState } from '../../components/common/States';
import { useAuth } from '../../auth/AuthContext';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../../lib/queries';
import { formatDateTime } from '../../lib/format';

const ICONS = {
  TASK_ASSIGNED: <AssignmentIndOutlinedIcon fontSize="small" />,
  STATUS_CHANGED: <SyncAltOutlinedIcon fontSize="small" />,
  COMMENT_ADDED: <ChatBubbleOutlineOutlinedIcon fontSize="small" />,
  DUE_SOON: <EventBusyOutlinedIcon fontSize="small" />,
  OVERDUE: <WarningAmberOutlinedIcon fontSize="small" />,
  MEMBER_ADDED: <GroupAddOutlinedIcon fontSize="small" />,
  AUTOMATION_TRIGGERED: <BoltOutlinedIcon fontSize="small" />,
};

// כל ההתראות, עם סינון וסימון כנקראו.
// נקרא מ: App.jsx
// קורא ל: useAuth, useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, LoadingState, PageHeader +2
export function NotificationCenterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const filtered = useMemo(() => {
    const list = notifications ?? [];
    return tab === 'unread' ? list.filter((n) => !n.read) : list;
  }, [notifications, tab]);

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  if (isLoading) return <LoadingState label="Loading notifications…" />;

  return (
    <Box>
      <PageHeader
        title="Notification Center"
        description="Stay on top of assignments, comments, and deadline changes."
        actions={
          unreadCount > 0 && (
            <Button variant="outlined" onClick={() => user && markAllRead.mutate(user.id)}>
              Mark all
            </Button>
          )
        }
      />

      <Card>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid #E7E7EB' }}>
          <Tab value="all" label={`All (${(notifications ?? []).length})`} />
          <Tab value="unread" label={`Unread (${unreadCount})`} />
        </Tabs>
        {filtered.length === 0 ? (
          <Box sx={{ py: 2 }}>
            <EmptyState title={tab === 'unread' ? "You're all caught up" : 'No notifications'} />
          </Box>
        ) : (
          <List disablePadding>
            {filtered.map((n) => (
              <ListItemButton
                key={n.id}
                onClick={() => {
                  if (!n.read) markRead.mutate(n.id);
                  if (n.relatedTaskId) navigate(`/tasks/${n.relatedTaskId}`);
                  else if (n.relatedProjectId) navigate(`/projects/${n.relatedProjectId}`);
                }}
                sx={{
                  px: 2.5,
                  py: 1.5,
                  borderBottom: '1px solid #F0F1F6',
                  backgroundColor: n.read ? 'transparent' : '#F4F7FF',
                  alignItems: 'flex-start',
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#EEF0F5',
                    color: 'primary.main',
                    flexShrink: 0,
                  }}
                >
                  {ICONS[n.type]}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="body2" fontWeight={n.read ? 500 : 700}>
                      {n.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, ml: 1 }}>
                      {formatDateTime(n.createdAt)}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {n.body}
                  </Typography>
                  {n.actionUrl && (
                    <Button
                      size="small"
                      variant="contained"
                      href={n.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      sx={{ mt: 1 }}
                    >
                      Join call
                    </Button>
                  )}
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}
      </Card>
    </Box>
  );
}
