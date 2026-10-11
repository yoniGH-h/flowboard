// תפקיד הקובץ: תפריט המשתמש.
// משתמשים בו: Topbar.jsx

import { useState } from 'react';
import ButtonBase from '@mui/material/ButtonBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { useAuth, ROLE_LABELS } from '../auth/AuthContext';
import { UserAvatar } from '../components/common/UserAvatar';
import { fullName } from '../lib/format';

// קישור לפרופיל וכפתור יציאה.
// נקרא מ: Topbar.jsx
export function UserMenu() {
  const [anchorEl, setAnchorEl] = useState(null);
  const { user, organization, activeRole, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, borderRadius: 2, px: 1, py: 0.5 }}
        aria-label="Open user menu"
      >
        <UserAvatar user={user} size="small" />
        <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left' }}>
          <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
            {fullName(user)}
          </Typography>
          <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
            {organization?.name}
          </Typography>
        </Box>
      </ButtonBase>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" fontWeight={700}>
            {fullName(user)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user.email}
          </Typography>
          <Typography variant="caption" display="block" color="primary.main" fontWeight={600}>
            {ROLE_LABELS[activeRole]}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            navigate('/profile');
          }}
        >
          <ListItemIcon>
            <PersonOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile & Settings</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            signOut();
            navigate('/sign-in');
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sign out</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
