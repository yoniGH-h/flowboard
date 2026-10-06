import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { Outlet } from 'react-router-dom';
import { DesktopSidebar, MobileSidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useNotificationsSocket } from '../lib/useNotificationsSocket';

const COLLAPSE_KEY = 'flowboard.sidebarCollapsed';

export function AppShell() {
  useNotificationsSocket();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? '0' : '1');
      return !prev;
    });
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
      <DesktopSidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} />
        {!online && (
          <Alert severity="warning" square role="status">
            You are offline. Existing content stays visible, and changes can resume when the connection returns.
          </Alert>
        )}
        <Box component="main" sx={{ flex: 1, p: { xs: 2, sm: 3 }, maxWidth: 1400, width: '100%', mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
