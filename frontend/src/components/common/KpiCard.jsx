// כרטיס מדד.

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

// כרטיס עם תווית, מספר ואייקון.
// נקרא מ: UserManagementPage.jsx, ManagementDashboardPage.jsx, PersonalDashboardPage.jsx, KanbanBoardPage.jsx +7
export function KpiCard({ label, value, icon, accentColor = '#3454D1', trend, helperText }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
          </Typography>
          {icon && (
            <Box sx={{ color: accentColor, opacity: 0.85, display: 'flex', '& svg': { fontSize: 18 } }} aria-hidden>
              {icon}
            </Box>
          )}
        </Stack>
        <Typography variant="h2" sx={{ mt: 1, fontWeight: 700 }}>
          {value}
        </Typography>
        {(trend || helperText) && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
            {trend && (
              <>
                {trend.direction === 'up' ? (
                  <TrendingUpIcon sx={{ fontSize: 14, color: trend.positive === false ? 'error.main' : 'success.main' }} />
                ) : (
                  <TrendingDownIcon sx={{ fontSize: 14, color: trend.positive === false ? 'success.main' : 'error.main' }} />
                )}
                <Typography variant="caption" fontWeight={600} color={trend.positive === false ? 'error.main' : 'success.main'}>
                  {trend.label}
                </Typography>
              </>
            )}
            {helperText && (
              <Typography variant="caption" color="text.secondary">
                {trend ? `· ${helperText}` : helperText}
              </Typography>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
