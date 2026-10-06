import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuIcon from '@mui/icons-material/Menu';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { RoleSwitcher } from './RoleSwitcher';
import { useAuth } from '../auth/AuthContext';

export function Topbar({ onOpenMobileNav }) {
  const { organization } = useAuth();
  return (
    <AppBar position="sticky" elevation={0} color="inherit" sx={{ backgroundColor: 'background.paper', borderBottom: '1px solid #E7E7EB' }}>
      <Toolbar sx={{ gap: 1.5 }}>
        <IconButton
          edge="start"
          onClick={onOpenMobileNav}
          sx={{ display: { xs: 'inline-flex', md: 'none' } }}
          aria-label="Open navigation menu"
        >
          <MenuIcon />
        </IconButton>
        {organization && (
          <Chip
            label={organization.name}
            size="small"
            variant="outlined"
            sx={{
              display: { xs: 'none', lg: 'flex' },
              fontWeight: 600,
              ...(organization.brandColor && {
                borderColor: organization.brandColor,
                color: organization.brandColor,
              }),
            }}
          />
        )}
        <Box
          sx={{ flexGrow: 1, minWidth: 0, display: 'flex', justifyContent: { xs: 'flex-start', sm: 'center' }, maxWidth: 480, mx: 'auto' }}
        >
          <GlobalSearch />
        </Box>
        <Box sx={{ flexGrow: { xs: 1, sm: 0 } }} />
        <RoleSwitcher />
        <NotificationBell />
        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
