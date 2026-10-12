// אווטאר של משתמש.

import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { initials, fullName, contrastTextColor } from '../../lib/format';

const SIZE_MAP = { small: 24, medium: 32, large: 48 };

// עיגול צבעוני עם ראשי התיבות של המשתמש.
// נקרא מ: TaskRow.jsx, ManagementDashboardPage.jsx, KanbanTaskCard.jsx, ProfileSettingsPage.jsx +3
export function UserAvatar({ user, size = 'medium' }) {
  const px = SIZE_MAP[size];
  if (!user) {
    return (
      <Tooltip title="Unassigned">
        <Avatar sx={{ width: px, height: px, fontSize: px * 0.4, bgcolor: '#E7E7EB', color: '#5C6478' }}>
          <PersonOutlineIcon sx={{ fontSize: px * 0.55 }} />
        </Avatar>
      </Tooltip>
    );
  }
  return (
    <Tooltip title={fullName(user)}>
      <Avatar sx={{ width: px, height: px, fontSize: px * 0.4, bgcolor: user.avatarColor, color: contrastTextColor(user.avatarColor) }}>
        {initials(user)}
      </Avatar>
    </Tooltip>
  );
}

// אווטאר לצד שם וכותרת משנה.
// נקרא מ: UserManagementPage.jsx, ProjectManagementPage.jsx, ProjectOverviewPage.jsx, ProjectTeamManagementPage.jsx +2
export function UserIdentity({ user, size = 'medium', subtitle }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <UserAvatar user={user} size={size} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {fullName(user)}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// כמה אווטארים חופפים, עם "+N" לשאר.
// נקרא מ: ProjectCard.jsx, ProjectOverviewPage.jsx
export function UserAvatarStack({ users, max = 4 }) {
  return (
    <AvatarGroup max={max} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: 12, borderColor: '#fff' } }}>
      {users.map((u) => (
        <UserAvatar key={u.id} user={u} size="small" />
      ))}
    </AvatarGroup>
  );
}
