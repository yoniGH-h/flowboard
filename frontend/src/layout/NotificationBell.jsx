import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Menu from '@mui/material/Menu';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { useNavigate } from 'react-router-dom';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../lib/queries';
import { useAuth } from '../auth/AuthContext';
import { formatRelativeToNow } from '../lib/format';
import { EmptyState } from '../components/common/States';

export function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = notifications.filter((n) => !n.read).length;
  const recent = notifications.slice(0, 6);

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label={`Notifications, ${unreadCount} unread`}
        sx={{ color: 'text.secondary' }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsNoneOutlinedIcon />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { width: 360, maxHeight: 480 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.25 }}>
          <Typography variant="subtitle1">Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={() => user && markAllRead.mutate(user.id)}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />
        {recent.length === 0 ? (
          <Box sx={{ py: 2 }}>
            <EmptyState title="You're all caught up" description="No notifications yet." />
          </Box>
        ) : (
          recent.map((n) => (
            <MenuItem
              key={n.id}
              onClick={() => {
                if (!n.read) markRead.mutate(n.id);
                setAnchorEl(null);
                if (n.relatedTaskId) navigate(`/tasks/${n.relatedTaskId}`);
                else navigate('/notifications');
              }}
              sx={{ whiteSpace: 'normal', alignItems: 'flex-start', py: 1.25, backgroundColor: n.read ? 'transparent' : '#F4F7FF' }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: n.read ? 'transparent' : 'primary.main',
                  mt: 0.75,
                  mr: 1.25,
                  flexShrink: 0,
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600}>
                  {n.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
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
                    sx={{ my: 0.5, py: 0.25 }}
                  >
                    Join call
                  </Button>
                )}
                <Typography variant="caption" color="text.secondary">
                  {formatRelativeToNow(n.createdAt, new Date())}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            navigate('/notifications');
          }}
          sx={{ justifyContent: 'center', fontWeight: 600, color: 'primary.main' }}
        >
          View all notifications
        </MenuItem>
      </Menu>
    </>
  );
}
