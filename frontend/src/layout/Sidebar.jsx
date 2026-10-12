// תפריט הצד.
// חלקים עיקריים: תוכן התפריט, תפריט למסך רחב, תפריט למסך צר.

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import ButtonBase from '@mui/material/ButtonBase';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { NAV_SECTIONS } from './navConfig';
import { useAuth, ROLE_LABELS } from '../auth/AuthContext';
import { ROLE_LEVEL } from '../lib/permissions';
import { useNotifications } from '../lib/queries';
import { UserAvatar } from '../components/common/UserAvatar';
import { fullName } from '../lib/format';

// רוחב התפריט כשהוא פתוח.
// נקרא מ: הקובץ הזה בלבד
export const SIDEBAR_WIDTH = 248;
// רוחב התפריט כשהוא מכווץ.
// נקרא מ: הקובץ הזה בלבד
export const SIDEBAR_WIDTH_COLLAPSED = 72;

const SIDEBAR_BG = '#111A2E';
const SIDEBAR_HOVER_BG = '#1B2440';
const SIDEBAR_TEXT = '#9BA5C0';
const SIDEBAR_TEXT_MUTED = '#7A84A6'; // עומד ביחס הניגודיות 4.5:1 של WCAG AA מול SIDEBAR_BG (הצבע #5C6685 הגיע רק ל-3:1 בערך)
const SIDEBAR_DIVIDER = 'rgba(255,255,255,0.08)';

function SidebarContent({ collapsed, onNavigate }) {
  const { activeRole, user } = useAuth();
  const navigate = useNavigate();
  const level = ROLE_LEVEL[activeRole];
  const location = useLocation();
  const { data: notifications } = useNotifications();
  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: SIDEBAR_BG, color: SIDEBAR_TEXT }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 2.25, minHeight: 64, flexShrink: 0 }}>
        <ViewKanbanIcon sx={{ color: 'primary.light', fontSize: 26 }} />
        {!collapsed && (
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5, color: '#fff' }}>
            FlowBoard
          </Typography>
        )}
      </Box>
      <Divider sx={{ borderColor: SIDEBAR_DIVIDER }} />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          py: 1,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3 },
        }}
      >
        {NAV_SECTIONS.filter((section) => level >= section.minLevel).map((section) => (
          <Box key={section.title} sx={{ mb: 1 }}>
            {!collapsed && (
              <Typography
                variant="caption"
                sx={{
                  px: 2.5,
                  color: SIDEBAR_TEXT_MUTED,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  fontSize: '0.68rem',
                }}
              >
                {section.title}
              </Typography>
            )}
            <List dense sx={{ px: 1 }}>
              {section.items
                .filter((item) => level >= item.minLevel)
                .map((item) => {
                  const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                  const isNotifications = item.path === '/notifications';
                  const icon =
                    isNotifications && unreadCount > 0 ? (
                      <Badge
                        badgeContent={unreadCount}
                        color="error"
                        sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 15, minWidth: 15 } }}
                      >
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    );
                  const button = (
                    <ListItemButton
                      component={NavLink}
                      to={item.path}
                      onClick={onNavigate}
                      selected={active}
                      aria-current={active ? 'page' : undefined}
                      sx={{
                        borderRadius: 1,
                        mb: 0.25,
                        py: 0.85,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        color: active ? '#fff' : SIDEBAR_TEXT,
                        backgroundColor: active ? 'primary.main' : 'transparent',
                        '&.Mui-selected': { backgroundColor: 'primary.main' },
                        '&.Mui-selected:hover': { backgroundColor: 'primary.main' },
                        '&:hover': { backgroundColor: active ? 'primary.main' : SIDEBAR_HOVER_BG },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: collapsed ? 0 : 34, color: active ? '#fff' : SIDEBAR_TEXT }}>{icon}</ListItemIcon>
                      {!collapsed && (
                        <ListItemText
                          primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: active ? 600 : 500 }}
                          primary={item.label}
                        />
                      )}
                    </ListItemButton>
                  );
                  return (
                    <ListItem key={item.path} disablePadding>
                      {collapsed ? (
                        <Tooltip title={item.label} placement="right">
                          {button}
                        </Tooltip>
                      ) : (
                        button
                      )}
                    </ListItem>
                  );
                })}
            </List>
          </Box>
        ))}
      </Box>
      <Divider sx={{ borderColor: SIDEBAR_DIVIDER }} />
      {user && (
        <ButtonBase
          onClick={() => {
            navigate('/profile');
            onNavigate?.();
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 2,
            py: 1.5,
            flexShrink: 0,
            justifyContent: collapsed ? 'center' : 'flex-start',
            '&:hover': { backgroundColor: SIDEBAR_HOVER_BG },
          }}
        >
          <UserAvatar user={user} size="small" />
          {!collapsed && (
            <Box sx={{ minWidth: 0, textAlign: 'left' }}>
              <Typography variant="body2" fontWeight={600} sx={{ color: '#fff' }} noWrap>
                {fullName(user)}
              </Typography>
              <Typography variant="caption" sx={{ color: SIDEBAR_TEXT_MUTED }} noWrap>
                {ROLE_LABELS[activeRole]}
              </Typography>
            </Box>
          )}
        </ButtonBase>
      )}
    </Box>
  );
}

// תפריט הצד במסך רחב, עם כיווץ.
// נקרא מ: AppShell.jsx
export function DesktopSidebar({ collapsed, onToggleCollapse }) {
  return (
    <Box
      component="nav"
      aria-label="Primary"
      sx={{
        width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH,
        flexShrink: 0,
        display: { xs: 'none', md: 'block' },
        transition: 'width 0.2s ease',
        position: 'sticky',
        alignSelf: 'flex-start',
        top: 0,
        height: '100vh',
        zIndex: (theme) => theme.zIndex.appBar + 1,
      }}
    >
      <SidebarContent collapsed={collapsed} />
      <IconButton
        onClick={onToggleCollapse}
        size="small"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        sx={{
          position: 'absolute',
          top: 18,
          right: -14,
          width: 28,
          height: 28,
          backgroundColor: 'background.paper',
          border: '1px solid #E7E7EB',
          '&:hover': { backgroundColor: '#F4F6FB' },
        }}
      >
        {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
}

// תפריט הצד במסך צר, כמגירה.
// נקרא מ: AppShell.jsx
export function MobileSidebar({ open, onClose }) {
  return (
    <Drawer
      variant="temporary"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH } }}
    >
      <SidebarContent collapsed={false} onNavigate={onClose} />
    </Drawer>
  );
}
